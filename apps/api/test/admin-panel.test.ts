import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  applications,
  commands,
  playerAccess,
  users,
} from "../src/db/schema.js";
import { browserHeaders, login, serverHeaders, setup } from "./helpers.js";

let ctx: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  ctx = await setup();
});

afterEach(async () => ctx.close());

it("exposes the admin panel API only to Discord IDs stored as admins", async () => {
  const applicantLogin = await login(ctx);
  const applicantCookies = { okrip_session: applicantLogin.cookie };
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: applicantCookies,
    headers: browserHeaders,
    payload: { minecraftUsername: "Panel_Player" },
  });
  expect(submitted.statusCode, submitted.body).toBe(201);

  const forbidden = await ctx.app.inject({
    url: "/v1/admin/applications",
    cookies: applicantCookies,
  });
  expect(forbidden.statusCode).toBe(403);
  expect(
    (
      await ctx.app.inject({
        url: "/v1/me",
        cookies: applicantCookies,
      })
    ).json().user.isAdmin,
  ).toBe(false);

  ctx.discord.identity.mockResolvedValue({
    id: "876509255308541977",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const adminLogin = await login(ctx);
  const adminCookies = { okrip_session: adminLogin.cookie };
  expect(
    (await ctx.app.inject({ url: "/v1/me", cookies: adminCookies })).json().user
      .isAdmin,
  ).toBe(true);

  const list = await ctx.app.inject({
    url: "/v1/admin/applications?status=pending",
    cookies: adminCookies,
  });
  expect(list.statusCode, list.body).toBe(200);
  expect(list.json()).toMatchObject({
    counts: { all: 1, pending: 1 },
    applications: [
      {
        minecraftUsername: "Panel_Player",
        discordUsername: "DiscordName",
        status: "pending",
      },
    ],
  });

  const decision = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/decision",
    cookies: adminCookies,
    headers: browserHeaders,
    payload: {
      publicId: submitted.json().application.publicId,
      action: "approve",
    },
  });
  expect(decision.statusCode, decision.body).toBe(200);
  expect(decision.json()).toEqual({ status: "approved" });
  expect((await ctx.db.select().from(applications))[0]!.status).toBe(
    "approved",
  );
  expect(await ctx.db.select().from(playerAccess)).toHaveLength(1);
  expect(await ctx.db.select().from(commands)).toHaveLength(1);
});

it("requires a rejection reason and applies origin protection", async () => {
  ctx.discord.identity.mockResolvedValue({
    id: "303118455635312641",
    username: "SecondAdmin",
    global_name: null,
    avatar: null,
  });
  const adminLogin = await login(ctx);
  const adminCookies = { okrip_session: adminLogin.cookie };
  expect(
    (await ctx.app.inject({ url: "/v1/me", cookies: adminCookies })).json().user
      .isAdmin,
  ).toBe(true);

  const missingReason = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/decision",
    cookies: adminCookies,
    headers: browserHeaders,
    payload: {
      publicId: "abcdefghijklmnop",
      action: "reject",
    },
  });
  expect(missingReason.statusCode).toBe(400);

  const response = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/decision",
    cookies: adminCookies,
    payload: {
      publicId: "abcdefghijklmnop",
      action: "reject",
      rejectionReason: "Причина",
    },
  });
  expect(response.statusCode).toBe(403);
});

it("adds, lists and removes whitelist players through the plugin command queue", async () => {
  ctx.discord.identity.mockResolvedValue({
    id: "554465791358140417",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const { cookie } = await login(ctx);
  const cookies = { okrip_session: cookie };

  const added = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/whitelist/add",
    cookies,
    headers: browserHeaders,
    payload: {
      minecraftUsername: "Manual_Player",
      discordUsername: "manual.user",
      discordId: "123456789012345678",
    },
  });
  expect(added.statusCode, added.body).toBe(200);
  expect(added.json()).toMatchObject({
    status: "active",
    synchronization: "waiting",
  });

  await ctx.db
    .update(users)
    .set({ discordAvatar: "a_ab3b37253e5fa49be449780b10c9e0e0" })
    .where(eq(users.discordId, "123456789012345678"));

  const listed = await ctx.app.inject({
    url: "/v1/admin/whitelist",
    cookies,
  });
  expect(listed.statusCode, listed.body).toBe(200);
  expect(listed.json()).toMatchObject({
    count: 1,
    players: [
      {
        minecraftUsername: "Manual_Player",
        discordUsername: "manual.user",
        discordId: "123456789012345678",
        discordAvatarUrl:
          "https://cdn.discordapp.com/avatars/123456789012345678/a_ab3b37253e5fa49be449780b10c9e0e0.gif?size=64",
      },
    ],
  });

  const addLease = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/commands/lease",
    headers: serverHeaders,
    payload: { limit: 1 },
  });
  expect(addLease.json().commands[0]).toMatchObject({
    type: "whitelist_add",
    payload: { username: "Manual_Player" },
  });
  await ctx.app.inject({
    method: "POST",
    url: `/v1/minecraft/commands/${addLease.json().commands[0].id}/complete`,
    headers: serverHeaders,
    payload: { leaseToken: addLease.json().commands[0].leaseToken },
  });

  const removed = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/whitelist/remove",
    cookies,
    headers: browserHeaders,
    payload: { accessId: added.json().accessId },
  });
  expect(removed.statusCode, removed.body).toBe(200);
  expect(removed.json()).toMatchObject({
    status: "revoked",
    synchronization: "waiting",
  });
  expect((await ctx.db.select().from(playerAccess))[0]!.status).toBe("revoked");
  expect(await ctx.db.select().from(commands)).toHaveLength(2);

  const removeLease = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/commands/lease",
    headers: serverHeaders,
    payload: { limit: 1 },
  });
  expect(removeLease.json().commands[0]).toMatchObject({
    type: "whitelist_remove",
    payload: { username: "Manual_Player" },
  });
  await ctx.app.inject({
    method: "POST",
    url: `/v1/minecraft/commands/${removeLease.json().commands[0].id}/complete`,
    headers: serverHeaders,
    payload: { leaseToken: removeLease.json().commands[0].leaseToken },
  });
  expect(
    (await ctx.app.inject({ url: "/v1/admin/whitelist", cookies })).json()
      .count,
  ).toBe(0);

  const restored = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/whitelist/add",
    cookies,
    headers: browserHeaders,
    payload: {
      minecraftUsername: "Manual_Player",
      discordUsername: "manual.user",
      discordId: "123456789012345678",
    },
  });
  expect(restored.statusCode, restored.body).toBe(200);
  expect(restored.json().status).toBe("active");
  expect(await ctx.db.select().from(commands)).toHaveLength(3);
});
