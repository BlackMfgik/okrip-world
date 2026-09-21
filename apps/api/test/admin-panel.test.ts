import { afterEach, beforeEach, expect, it } from "vitest";
import { applications, commands, playerAccess } from "../src/db/schema.js";
import { browserHeaders, login, setup } from "./helpers.js";

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
    id: "554465791358140417",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const adminLogin = await login(ctx);
  const adminCookies = { okrip_session: adminLogin.cookie };
  expect(
    (
      await ctx.app.inject({ url: "/v1/me", cookies: adminCookies })
    ).json().user.isAdmin,
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
    (
      await ctx.app.inject({ url: "/v1/me", cookies: adminCookies })
    ).json().user.isAdmin,
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
