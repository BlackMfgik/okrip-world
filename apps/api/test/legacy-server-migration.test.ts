import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { testDatabase } from "./test-database.js";

// Міграція 0020 на порожній БД нічого не змінює, тому тест засіває дані в стані «після 0019»
// і виконує її SQL ще раз в одній транзакції — так само, як це робить migrator.
const MIGRATION = readFileSync(
  "src/db/migrations/0020_move_legacy_access_to_modded.sql",
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const BEFORE_0019 = "2026-10-10 12:00:00+00";
const AFTER_0019 = "2026-10-23 18:00:00+00";

let database: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => {
  database = await testDatabase();
});
afterEach(async () => database.close());

const rows = async <T>(query: ReturnType<typeof sql>) =>
  (await database.db.execute(query)).rows as T[];

let nextDiscordId = 100000000000000000n;
async function player(name: string) {
  const [user] = await rows<{ id: string }>(sql`
    insert into users (discord_id, discord_username)
    values (${String(nextDiscordId++)}, ${name}) returning id`);
  const [identity] = await rows<{ id: string }>(sql`
    insert into minecraft_identities (user_id, username, normalized_username)
    values (${user!.id}, ${name}, ${name.toLowerCase()}) returning id`);
  return { userId: user!.id, identityId: identity!.id };
}

async function application(
  owner: { userId: string; identityId: string },
  serverId: string,
  createdAt: string,
  approve: boolean,
) {
  const [row] = await rows<{ id: string }>(sql`
    insert into applications (public_id, user_id, minecraft_identity_id, server_id, created_at)
    values (${"pub" + Math.random().toString(36).slice(2, 15)}, ${owner.userId},
      ${owner.identityId}, ${serverId}, ${createdAt}) returning id`);
  if (approve)
    await database.db.execute(
      sql`update applications set status = 'approved' where id = ${row!.id}`,
    );
  return row!.id;
}

async function access(
  owner: { userId: string; identityId: string },
  serverId: string,
  createdAt: string,
) {
  const [row] = await rows<{ id: string }>(sql`
    insert into player_access (user_id, minecraft_identity_id, server_id, status, created_at)
    values (${owner.userId}, ${owner.identityId}, ${serverId}, 'active', ${createdAt})
    returning id`);
  return row!.id;
}

async function command(accessId: string, status: string) {
  const [row] = await rows<{ id: string }>(sql`
    insert into minecraft_commands (server_id, player_access_id, type, payload, status)
    values ('vanilla', ${accessId}, 'whitelist_add', '{"username":"x"}'::jsonb, ${status})
    returning id`);
  return row!.id;
}

const serverOf = async (table: "player_access" | "applications", id: string) =>
  (
    await rows<{ server_id: string }>(
      sql`select server_id from ${sql.identifier(table)} where id = ${id}`,
    )
  )[0]!.server_id;

async function runMigration() {
  await database.db.transaction(async (tx) => {
    for (const statement of MIGRATION) await tx.execute(sql.raw(statement));
  });
}

it("moves pre-0019 vanilla access, applications and unfinished commands to modded", async () => {
  // Старий гравець Amega, записаний 0019 як vanilla.
  const legacy = await player("Legacy_One");
  const legacyApplication = await application(
    legacy,
    "vanilla",
    BEFORE_0019,
    true,
  );
  const legacyAccess = await access(legacy, "vanilla", BEFORE_0019);
  const pendingCommand = await command(legacyAccess, "pending");
  const failedCommand = await command(legacyAccess, "failed");
  const completedCommand = await command(legacyAccess, "completed");

  // Старий гравець, який після 0019 вже отримав доступ на modded: дубль не створюємо.
  const reapplied = await player("Reapplied");
  const reappliedOldAccess = await access(reapplied, "vanilla", BEFORE_0019);
  const reappliedNewAccess = await access(reapplied, "modded", AFTER_0019);

  // Доступ, виданий на vanilla після 0019, — не спадщина міграції, лишається.
  const recent = await player("Recent");
  const recentAccess = await access(recent, "vanilla", AFTER_0019);

  // Стара заявка на розгляді, коли вже є нова на modded: друга на розгляді неможлива.
  const waiting = await player("Waiting");
  const oldPending = await application(waiting, "vanilla", BEFORE_0019, false);
  const newPending = await application(waiting, "modded", AFTER_0019, false);

  await runMigration();

  expect(await serverOf("player_access", legacyAccess)).toBe("modded");
  expect(await serverOf("applications", legacyApplication)).toBe("modded");
  const commandServers = Object.fromEntries(
    (
      await rows<{ id: string; server_id: string }>(
        sql`select id, server_id from minecraft_commands`,
      )
    ).map((row) => [row.id, row.server_id]),
  );
  expect(commandServers).toEqual({
    [pendingCommand]: "modded",
    [failedCommand]: "modded",
    // Виконана команда — історія, її не чіпаємо.
    [completedCommand]: "vanilla",
  });

  expect(await serverOf("player_access", reappliedOldAccess)).toBe("vanilla");
  expect(await serverOf("player_access", reappliedNewAccess)).toBe("modded");
  expect(await serverOf("player_access", recentAccess)).toBe("vanilla");
  expect(await serverOf("applications", oldPending)).toBe("vanilla");
  expect(await serverOf("applications", newPending)).toBe("modded");

  const audit = await rows<{ entity_id: string; actor_id: string }>(
    sql`select entity_id, actor_id from audit_events where event_type = 'access_server_moved'`,
  );
  expect(audit).toEqual([
    { entity_id: legacyAccess, actor_id: "migration_0020" },
  ]);

  // Повторний запуск нічого не змінює.
  await runMigration();
  expect(
    await rows(
      sql`select 1 from audit_events where event_type = 'access_server_moved'`,
    ),
  ).toHaveLength(1);
});

it("restores the guards so server_id stays immutable after the migration", async () => {
  const owner = await player("Guarded");
  const accessId = await access(owner, "vanilla", BEFORE_0019);
  const applicationId = await application(owner, "modded", AFTER_0019, false);
  await runMigration();
  expect(await serverOf("player_access", accessId)).toBe("modded");

  for (const statement of [
    sql`update player_access set server_id = 'vanilla' where id = ${accessId}`,
    sql`update applications set server_id = 'vanilla' where id = ${applicationId}`,
  ])
    await expect(
      database.db.transaction(async (tx) => {
        // Навіть із прапорцем міграції зміна сервера заборонена.
        await tx.execute(
          sql`select set_config('okrip.move_legacy_to_modded', 'on', true)`,
        );
        await tx.execute(statement);
      }),
    ).rejects.toThrow();
});
