import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { testDatabase } from "./test-database.js";

// Міграції 0021 і 0022 на порожній БД нічого не змінюють, тому тест засіває гравців і адміна
// й виконує їхній SQL ще раз в одній транзакції — так само, як це робить migrator.
const migration = (file: string) =>
  readFileSync("src/db/migrations/" + file, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
const REVOKE = migration("0021_revoke_non_admin_access.sql");
const DELETE = migration("0022_delete_non_admin_data.sql");

const ADMIN_DISCORD_ID = "900000000000000001";

let database: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => {
  database = await testDatabase();
  await database.db.execute(
    sql`insert into admin_accounts (discord_id) values (${ADMIN_DISCORD_ID})`,
  );
});
afterEach(async () => database.close());

const rows = async <T>(query: ReturnType<typeof sql>) =>
  (await database.db.execute(query)).rows as T[];

let nextDiscordId = 100000000000000000n;
async function player(name: string, discordId = String(nextDiscordId++)) {
  const [user] = await rows<{ id: string }>(sql`
    insert into users (discord_id, discord_username)
    values (${discordId}, ${name}) returning id`);
  const [identity] = await rows<{ id: string }>(sql`
    insert into minecraft_identities (user_id, username, normalized_username)
    values (${user!.id}, ${name}, ${name.toLowerCase()}) returning id`);
  return { userId: user!.id, identityId: identity!.id };
}

async function access(
  owner: { userId: string; identityId: string },
  serverId: string,
  status: "active" | "revoked" | "banned",
) {
  const [row] = await rows<{ id: string }>(sql`
    insert into player_access (user_id, minecraft_identity_id, server_id, status)
    values (${owner.userId}, ${owner.identityId}, ${serverId}, ${status})
    returning id`);
  return row!.id;
}

async function pendingApplication(owner: {
  userId: string;
  identityId: string;
}) {
  const [row] = await rows<{ id: string }>(sql`
    insert into applications (public_id, user_id, minecraft_identity_id, server_id)
    values (${"pub" + Math.random().toString(36).slice(2, 15)}, ${owner.userId},
      ${owner.identityId}, 'modded') returning id`);
  return row!.id;
}

const statusOf = async (table: "player_access" | "applications", id: string) =>
  (
    await rows<{ status: string }>(
      sql`select status from ${sql.identifier(table)} where id = ${id}`,
    )
  )[0]!.status;

async function runMigration(statements: string[]) {
  await database.db.transaction(async (tx) => {
    for (const statement of statements) await tx.execute(sql.raw(statement));
  });
}

it("revokes every non-admin access and queues whitelist_remove on its server", async () => {
  const admin = await player("Admin_Main", ADMIN_DISCORD_ID);
  // Заявку створюємо до доступу: тригер не дає подати нову за наявного доступу.
  const adminApplication = await pendingApplication(admin);
  const adminAccess = await access(admin, "modded", "active");

  const amega = await player("Amega_Player");
  const amegaAccess = await access(amega, "modded", "active");
  const vanilla = await player("Vanilla_Player");
  const vanillaAccess = await access(vanilla, "vanilla", "active");
  const banned = await player("Banned_Player");
  const bannedAccess = await access(banned, "modded", "banned");
  const waiting = await player("Waiting");
  const waitingApplication = await pendingApplication(waiting);

  await runMigration(REVOKE);

  expect(await statusOf("player_access", adminAccess)).toBe("active");
  expect(await statusOf("player_access", amegaAccess)).toBe("revoked");
  expect(await statusOf("player_access", vanillaAccess)).toBe("revoked");
  expect(await statusOf("player_access", bannedAccess)).toBe("banned");
  expect(await statusOf("applications", adminApplication)).toBe("pending");
  expect(await statusOf("applications", waitingApplication)).toBe("cancelled");

  const queued = await rows<{
    server_id: string;
    player_access_id: string;
    type: string;
    payload: { username: string };
    status: string;
  }>(
    sql`select server_id, player_access_id, type, payload, status
        from minecraft_commands order by server_id`,
  );
  expect(queued).toEqual([
    {
      server_id: "modded",
      player_access_id: amegaAccess,
      type: "whitelist_remove",
      payload: { username: "Amega_Player" },
      status: "pending",
    },
    {
      server_id: "vanilla",
      player_access_id: vanillaAccess,
      type: "whitelist_remove",
      payload: { username: "Vanilla_Player" },
      status: "pending",
    },
  ]);

  const audit = await rows<{ entity_id: string }>(
    sql`select entity_id from audit_events where actor_id = 'migration_0021'`,
  );
  expect(audit.map((row) => row.entity_id).sort()).toEqual(
    [amegaAccess, vanillaAccess].sort(),
  );

  // Повторний запуск не ставить команд удруге.
  await runMigration(REVOKE);
  expect(await rows(sql`select 1 from minecraft_commands`)).toHaveLength(2);
});

const count = async (table: string) =>
  (await rows(sql`select 1 from ${sql.identifier(table)}`)).length;

const completeCommands = () =>
  database.db.execute(
    sql`update minecraft_commands set status = 'completed', completed_at = now()`,
  );

it("deletes every non-admin player and all history once the plugins removed them", async () => {
  const admin = await player("Admin_Main", ADMIN_DISCORD_ID);
  await pendingApplication(admin);
  const adminAccess = await access(admin, "modded", "active");
  await database.db.execute(sql`
    insert into minecraft_commands (server_id, player_access_id, type, payload)
    values ('modded', ${adminAccess}, 'whitelist_add', '{"username":"Admin_Main"}'::jsonb)`);

  const amega = await player("Amega_Player");
  await pendingApplication(amega);
  await access(amega, "modded", "active");
  const banned = await player("Banned_Player");
  await access(banned, "modded", "banned");
  await player("No_Access");
  await database.db.execute(sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${amega.userId}, 'hash', now() + interval '1 day')`);
  await database.db.execute(sql`
    insert into ban_events (event_id, server_id)
    values (gen_random_uuid(), 'modded')`);

  await runMigration(REVOKE);
  await completeCommands();
  await runMigration(DELETE);

  expect(await rows(sql`select discord_id from users`)).toEqual([
    { discord_id: ADMIN_DISCORD_ID },
  ]);
  expect(await rows(sql`select username from minecraft_identities`)).toEqual([
    { username: "Admin_Main" },
  ]);
  expect(await rows(sql`select id, status from player_access`)).toEqual([
    { id: adminAccess, status: "active" },
  ]);
  for (const table of [
    "applications",
    "telegram_jobs",
    "minecraft_commands",
    "sessions",
    "oauth_states",
    "ban_events",
    "audit_events",
  ])
    expect(await count(table), table).toBe(0);
  expect(await count("admin_accounts")).toBeGreaterThan(0);

  // Нік і Discord видаленого гравця знову вільні для нової заявки.
  await player("Amega_Player");
});

it("keeps unfinished admin commands in the queue", async () => {
  const admin = await player("Admin_Main", ADMIN_DISCORD_ID);
  const adminAccess = await access(admin, "modded", "active");
  await database.db.execute(sql`
    insert into minecraft_commands (server_id, player_access_id, type, payload)
    values ('modded', ${adminAccess}, 'whitelist_add', '{"username":"Admin_Main"}'::jsonb)`);
  await runMigration(DELETE);
  expect(await rows(sql`select status from minecraft_commands`)).toEqual([
    { status: "pending" },
  ]);
});

it("refuses to delete anything while the plugins have not removed the players", async () => {
  const amega = await player("Amega_Player");
  await access(amega, "modded", "active");

  // Без кроку 1 гравець ще активний.
  await expect(runMigration(DELETE)).rejects.toThrow();
  // Після кроку 1 whitelist_remove ще не виконано.
  await runMigration(REVOKE);
  await expect(runMigration(DELETE)).rejects.toThrow();
  expect(await count("users")).toBe(1);
  expect(await count("audit_events")).toBe(1);

  await completeCommands();
  await runMigration(DELETE);
  expect(await count("users")).toBe(0);
});
