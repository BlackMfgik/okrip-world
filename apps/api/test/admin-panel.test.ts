import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  adminAccounts,
  applications,
  commands,
  playerAccess,
  users,
} from "../src/db/schema.js";
import { browserHeaders, env, login, serverHeaders, setup } from "./helpers.js";
import { applicationService } from "../src/modules/applications/application.service.js";

let ctx: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  ctx = await setup();
});

afterEach(async () => ctx.close());

it("exposes the admin panel API only to Discord IDs stored as admins", async () => {
  const applicantLogin = await login(ctx);
  await ctx.db
    .update(users)
    .set({ discordAvatar: "a_applicationavatar" })
    .where(eq(users.discordId, "111"));
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
  expect(
    (
      await ctx.app.inject({
        url: "/v1/me",
        cookies: applicantCookies,
      })
    ).json().user.canManageAdmins,
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
        discordAvatarUrl:
          "https://cdn.discordapp.com/avatars/111/a_applicationavatar.gif?size=64",
        applicationBlocked: false,
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
  expect(
    (await ctx.app.inject({ url: "/v1/me", cookies: adminCookies })).json().user
      .canManageAdmins,
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

it("does not request or accept a Telegram reason after a website rejection", async () => {
  const applicant = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: { okrip_session: applicant.cookie },
    headers: browserHeaders,
    payload: { minecraftUsername: "Reply_Player" },
  });
  expect(submitted.statusCode, submitted.body).toBe(201);
  const publicId = submitted.json().application.publicId as string;
  await ctx.worker.tick();
  ctx.telegram.call.mockClear();

  ctx.discord.identity.mockResolvedValue({
    id: "876509255308541977",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const admin = await login(ctx);
  const rejected = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/decision",
    cookies: { okrip_session: admin.cookie },
    headers: browserHeaders,
    payload: {
      publicId,
      action: "reject",
      rejectionReason: "Причина із сайту",
    },
  });
  expect(rejected.statusCode, rejected.body).toBe(200);

  await ctx.worker.tick();
  await ctx.worker.tick();
  expect(ctx.telegram.call).not.toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({
      text: expect.stringContaining(`#reject:${publicId}`),
      reply_markup: expect.objectContaining({ force_reply: true }),
    }),
  );

  const reply = await ctx.app.inject({
    method: "POST",
    url: "/v1/integrations/telegram/webhook",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET,
    },
    payload: {
      update_id: 10,
      message: {
        message_id: 789,
        text: "Уточнена причина з Telegram",
        from: { id: 77, is_bot: false, username: "Moderator" },
        chat: { id: -100 },
        reply_to_message: {
          text: `Заявку №1 відхилено на сайті.\n#reject:${publicId}`,
          from: { is_bot: true },
        },
      },
    },
  });
  expect(reply.statusCode, reply.body).toBe(200);
  expect((await ctx.db.select().from(applications))[0]!.rejectionReason).toBe(
    "Причина із сайту",
  );
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({
      text: "Заявку вже було розглянуто: rejected",
    }),
  );
});

it("lets only protected owners add and remove regular web admins", async () => {
  ctx.discord.identity.mockResolvedValue({
    id: "554465791358140417",
    username: "OwnerAdmin",
    global_name: null,
    avatar: null,
  });
  const owner = await login(ctx);
  const ownerCookies = { okrip_session: owner.cookie };

  const initial = await ctx.app.inject({
    url: "/v1/admin/accounts",
    cookies: ownerCookies,
  });
  expect(initial.statusCode, initial.body).toBe(200);
  expect(initial.json().count).toBe(3);
  expect(
    initial
      .json()
      .accounts.filter((account: { canManageAdmins: boolean }) =>
        Boolean(account.canManageAdmins),
      ),
  ).toHaveLength(2);

  const regularAdminId = "99999999999999999";
  const added = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/accounts/add",
    cookies: ownerCookies,
    headers: browserHeaders,
    payload: { discordId: regularAdminId },
  });
  expect(added.statusCode, added.body).toBe(200);
  expect(await ctx.db.select().from(adminAccounts)).toHaveLength(4);

  ctx.discord.identity.mockResolvedValue({
    id: regularAdminId,
    username: "RegularAdmin",
    global_name: null,
    avatar: null,
  });
  const regular = await login(ctx);
  const regularCookies = { okrip_session: regular.cookie };
  expect(
    (await ctx.app.inject({ url: "/v1/me", cookies: regularCookies })).json()
      .user,
  ).toMatchObject({ isAdmin: true, canManageAdmins: false });

  const forbiddenAdd = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/accounts/add",
    cookies: regularCookies,
    headers: browserHeaders,
    payload: { discordId: "88888888888888888" },
  });
  expect(forbiddenAdd.statusCode).toBe(403);

  const protectedRemoval = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/accounts/remove",
    cookies: ownerCookies,
    headers: browserHeaders,
    payload: { discordId: "303118455635312641" },
  });
  expect(protectedRemoval.statusCode).toBe(403);

  const removed = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/accounts/remove",
    cookies: ownerCookies,
    headers: browserHeaders,
    payload: { discordId: regularAdminId },
  });
  expect(removed.statusCode, removed.body).toBe(200);
  expect(
    (await ctx.app.inject({ url: "/v1/me", cookies: regularCookies })).json()
      .user,
  ).toMatchObject({ isAdmin: false, canManageAdmins: false });
});

it("blocks applications permanently or for one hour", async () => {
  await ctx.close();
  ctx = await setup({ APPLICATION_REPEAT_DEBUG: true });
  const applicant = await login(ctx);
  const applicantCookies = { okrip_session: applicant.cookie };
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: applicantCookies,
    headers: browserHeaders,
    payload: { minecraftUsername: "Blocked_Player" },
  });
  expect(submitted.statusCode, submitted.body).toBe(201);
  const publicId = submitted.json().application.publicId;

  ctx.discord.identity.mockResolvedValue({
    id: "876509255308541977",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const admin = await login(ctx);
  const adminCookies = { okrip_session: admin.cookie };
  const blocked = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/block",
    cookies: adminCookies,
    headers: browserHeaders,
    payload: { publicId, blocked: true },
  });
  expect(blocked.statusCode, blocked.body).toBe(200);
  expect(blocked.json().applicationBlocked).toBe(true);

  const denied = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: applicantCookies,
    headers: browserHeaders,
    payload: { minecraftUsername: "Blocked_Again" },
  });
  expect(denied.statusCode, denied.body).toBe(403);
  expect(denied.json().code).toBe("application_blocked");
  expect(
    (
      await ctx.app.inject({
        url: "/v1/admin/applications?status=all",
        cookies: adminCookies,
      })
    ).json().applications[0].applicationBlocked,
  ).toBe(true);

  const unblocked = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/block",
    cookies: adminCookies,
    headers: browserHeaders,
    payload: { publicId, blocked: false },
  });
  expect(unblocked.statusCode, unblocked.body).toBe(200);
  expect(unblocked.json().applicationBlocked).toBe(false);

  const applicantUser = (
    await ctx.db.select().from(users).where(eq(users.discordId, "111"))
  )[0]!;
  await expect(
    applicationService(ctx.db, ctx.discord, true).submit(applicantUser, {
      minecraftUsername: "Allowed_Again",
    }),
  ).resolves.toMatchObject({
    application: { minecraftUsername: "Allowed_Again" },
  });

  const temporary = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/applications/block",
    cookies: adminCookies,
    headers: browserHeaders,
    payload: { publicId, blocked: true, durationMinutes: 60 },
  });
  expect(temporary.statusCode, temporary.body).toBe(200);
  expect(temporary.json().applicationBlocked).toBe(true);
  expect(Date.parse(temporary.json().applicationBlockedUntil)).toBeGreaterThan(
    Date.now() + 59 * 60_000,
  );
  await expect(
    applicationService(ctx.db, ctx.discord, true).submit(applicantUser, {
      minecraftUsername: "Still_Blocked",
    }),
  ).rejects.toMatchObject({ code: "application_blocked" });

  await ctx.db
    .update(users)
    .set({ applicationBlockedUntil: new Date(Date.now() - 1_000) })
    .where(eq(users.id, applicantUser.id));
  await expect(
    applicationService(ctx.db, ctx.discord, true).submit(applicantUser, {
      minecraftUsername: "Hour_Expired",
    }),
  ).resolves.toMatchObject({
    application: { minecraftUsername: "Hour_Expired" },
  });
  const refreshedUser = (
    await ctx.db.select().from(users).where(eq(users.id, applicantUser.id))
  )[0]!;
  expect(refreshedUser.applicationBlockedAt).toBeNull();
  expect(refreshedUser.applicationBlockedUntil).toBeNull();
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
