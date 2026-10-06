import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema.js";
import {
  discordMembershipEnricher,
  discordProvider,
} from "../src/modules/auth/index.js";
import { discordAccountCreatedAt } from "../src/shared/discord-account.js";
import { browserHeaders, env, login, setup } from "./helpers.js";

const joinedAt = new Date("2026-09-01T10:20:30.000Z");
let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await ctx.close();
});

async function applicant() {
  ctx.discord.identity.mockResolvedValue({
    id: "175928847299117063",
    username: "Applicant",
    global_name: null,
    avatar: null,
  });
  const session = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    headers: browserHeaders,
    cookies: { okrip_session: session.cookie },
    payload: { minecraftUsername: "Dates_Player" },
  });
  expect(submitted.statusCode, submitted.body).toBe(201);
  return (
    await ctx.db
      .select()
      .from(users)
      .where(eq(users.discordId, "175928847299117063"))
  )[0]!;
}

async function adminCookie() {
  ctx.discord.identity.mockResolvedValue({
    id: "876509255308541977",
    username: "Moderator",
    global_name: null,
    avatar: null,
  });
  return { okrip_session: (await login(ctx)).cookie };
}

it("decodes a real Discord snowflake without losing precision and rejects invalid IDs", () => {
  expect(discordAccountCreatedAt("175928847299117063")).toBe(
    "2016-04-30T11:18:25.796Z",
  );
  for (const id of ["", "not-an-id", "-1", "0", "18446744073709551616"]) {
    expect(discordAccountCreatedAt(id)).toBeNull();
  }
});

it("reads Discord's offset timestamp with microseconds and preserves membership screening", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        pending: false,
        joined_at: "2015-04-26T06:26:56.936000+00:00",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ pending: true, joined_at: joinedAt.toISOString() }),
    );
  vi.stubGlobal("fetch", fetch);
  const provider = discordProvider(env);
  await expect(provider.membership("111")).resolves.toEqual({
    joinedAt: new Date("2015-04-26T06:26:56.936Z"),
  });
  await expect(provider.membership("111")).rejects.toMatchObject({
    code: "guild_screening",
  });
  expect(fetch).toHaveBeenCalledWith(
    "https://discord.com/api/v10/guilds/456/members/111",
    expect.objectContaining({ headers: { Authorization: "Bot bot" } }),
  );
});

it("keeps missing membership dates unknown and rejects members outside the guild", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ pending: false }))
      .mockResolvedValueOnce(new Response(null, { status: 404 })),
  );
  const provider = discordProvider(env);
  await expect(provider.membership("111")).resolves.toEqual({ joinedAt: null });
  await expect(provider.membership("111")).rejects.toMatchObject({
    code: "guild_required",
  });
});

it("refreshes the membership date on submission and exposes both Discord dates only to admins", async () => {
  const nextJoin = new Date("2026-10-02T12:34:56.000Z");
  ctx.discord.membership
    .mockResolvedValueOnce({ joinedAt })
    .mockResolvedValueOnce({ joinedAt: nextJoin });
  const user = await applicant();
  expect(user.discordGuildJoinedAt).toEqual(nextJoin);
  const response = await ctx.app.inject({
    url: "/v1/admin/applications",
    cookies: await adminCookie(),
  });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().applications[0]).toMatchObject({
    discordAccountCreatedAt: "2016-04-30T11:18:25.796Z",
    discordGuildJoinedAt: nextJoin.toISOString(),
  });
});

it("backfills legacy applications, persists their join date and avoids subsequent Discord lookups", async () => {
  const user = await applicant();
  await ctx.db
    .update(users)
    .set({ discordGuildJoinedAt: null })
    .where(eq(users.id, user.id));
  const cookies = await adminCookie();
  ctx.discord.membership.mockClear();
  const list = () => ctx.app.inject({ url: "/v1/admin/applications", cookies });
  const first = await list();
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json().applications[0].discordGuildJoinedAt).toBe(
    joinedAt.toISOString(),
  );
  expect(
    (await ctx.db.select().from(users).where(eq(users.id, user.id)))[0]!
      .discordGuildJoinedAt,
  ).toEqual(joinedAt);
  await list();
  expect(ctx.discord.membership).toHaveBeenCalledExactlyOnceWith(
    user.discordId,
    { retries: 0 },
  );
});

it("keeps moderation available when legacy enrichment fails and cools down repeated lookups", async () => {
  const user = await applicant();
  await ctx.db
    .update(users)
    .set({ discordGuildJoinedAt: null })
    .where(eq(users.id, user.id));
  const cookies = await adminCookie();
  ctx.discord.membership
    .mockClear()
    .mockRejectedValue(new Error("Discord unavailable"));
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ctx.app.inject({
      url: "/v1/admin/applications",
      cookies,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().applications[0].discordGuildJoinedAt).toBeNull();
  }
  expect(ctx.discord.membership).toHaveBeenCalledTimes(1);
});

it("bounds legacy enrichment and shares lookups across simultaneous admin requests", async () => {
  const members = await ctx.db
    .insert(users)
    .values(
      Array.from({ length: 7 }, (_, index) => ({
        discordId: String(175928847299117063n + BigInt(index)),
        discordUsername: `Player${index}`,
      })),
    )
    .returning();
  let finish!: (value: { joinedAt: Date }) => void;
  const pending = new Promise<{ joinedAt: Date }>((resolve) => {
    finish = resolve;
  });
  ctx.discord.membership.mockImplementation(() => pending);
  const enrich = discordMembershipEnricher(ctx.db, ctx.discord);
  const first = enrich([...members, members[0]!]);
  const second = enrich(members);
  expect(ctx.discord.membership).toHaveBeenCalledTimes(4);
  finish({ joinedAt });
  const results = await Promise.all([first, second]);
  expect(results.map((result) => result.size)).toEqual([4, 4]);
  expect(
    (await ctx.db.select().from(users)).filter(
      (user) => user.discordGuildJoinedAt,
    ),
  ).toHaveLength(4);
  const refreshed = await ctx.db.select().from(users);
  ctx.discord.membership.mockResolvedValue({ joinedAt });
  await enrich(refreshed);
  expect(ctx.discord.membership).toHaveBeenCalledTimes(7);
});
