import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  setup,
  login,
  env,
  browserHeaders,
  telegramBody,
  serverHeaders,
} from "./helpers.js";
import {
  applications,
  commands,
  identities,
  playerAccess,
  users,
} from "../src/db/schema.js";
import {
  APPLICATION_SUBMISSION_COOLDOWN_MS,
  applicationService,
} from "../src/modules/applications/application.service.js";
import { moderationService } from "../src/modules/moderation/moderation.service.js";
import { minecraftUsernameSchema } from "@okrip/contracts";
let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => ctx.close());
it("submits, durably sends Telegram, approves exactly once, leases and completes", async () => {
  const { cookie } = await login(ctx);
  const cookies = { okrip_session: cookie };
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies,
    headers: browserHeaders,
    payload: { minecraftUsername: "Player_One" },
  });
  expect(submitted.statusCode, submitted.body).toBe(201);
  expect(ctx.discord.membership).not.toHaveBeenCalled();
  const publicId = submitted.json().application.publicId;
  expect((await ctx.db.select().from(identities))[0]!.normalizedUsername).toBe(
    "player_one",
  );
  await ctx.worker.tick();
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({
      text: expect.stringMatching(
        /^🧾Заявка №1\n🔵Discord: DiscordName\n💰Нікнейм: Player_One\n🗓Дата: \d{2}\.\d{2}\.\d{2} \d{2}:\d{2}\n⏳Статус: Очікує рішення$/,
      ),
    }),
  );
  const approve = () =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/integrations/telegram/webhook",
      headers: {
        "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET,
      },
      payload: telegramBody(publicId),
    });
  expect((await approve()).statusCode).toBe(200);
  expect((await approve()).statusCode).toBe(200);
  expect(await ctx.db.select().from(playerAccess)).toHaveLength(1);
  expect(await ctx.db.select().from(commands)).toHaveLength(1);
  const whitelistSnapshot = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/whitelist/snapshot",
    headers: serverHeaders,
    payload: {},
  });
  expect(whitelistSnapshot.statusCode).toBe(200);
  expect(whitelistSnapshot.json().usernames).toEqual(["Player_One"]);
  expect(
    (await ctx.app.inject({ url: "/v1/applications/current", cookies })).json()
      .synchronization,
  ).toBe("waiting");
  const leased = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/commands/lease",
    headers: serverHeaders,
    payload: { limit: 1 },
  });
  expect(leased.statusCode, leased.body).toBe(200);
  const command = leased.json().commands[0];
  const ack = () =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/minecraft/commands/" + command.id + "/complete",
      headers: serverHeaders,
      payload: { leaseToken: command.leaseToken },
    });
  expect((await ack()).statusCode).toBe(204);
  expect((await ack()).statusCode).toBe(204);
  expect(
    (await ctx.app.inject({ url: "/v1/applications/current", cookies })).json()
      .synchronization,
  ).toBe("completed");
  await ctx.worker.tick();
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "editMessageText",
    expect.objectContaining({
      text: expect.stringContaining("✅Статус: Схвалено"),
      reply_markup: { inline_keyboard: [] },
    }),
  );
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "editMessageText",
    expect.objectContaining({
      text: expect.stringContaining("👤Схвалив: @Moderator"),
    }),
  );
});
it("auto-approves a submission, queues whitelist_add, and includes it in snapshot", async () => {
  await ctx.close();
  ctx = await setup({ APPLICATION_AUTO_APPROVE: true });
  const { cookie } = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: { okrip_session: cookie },
    headers: browserHeaders,
    payload: { minecraftUsername: "Auto_Player" },
  });

  expect(submitted.statusCode, submitted.body).toBe(201);
  expect(submitted.json()).toMatchObject({
    application: { status: "approved", minecraftUsername: "Auto_Player" },
    access: "active",
    synchronization: "waiting",
  });
  expect((await ctx.db.select().from(playerAccess))[0]!.status).toBe("active");
  expect(await ctx.db.select().from(commands)).toHaveLength(1);

  const snapshot = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/whitelist/snapshot",
    headers: serverHeaders,
    payload: {},
  });
  expect(snapshot.statusCode, snapshot.body).toBe(200);
  expect(snapshot.json().usernames).toEqual(["Auto_Player"]);

  const leased = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/commands/lease",
    headers: serverHeaders,
    payload: { limit: 1 },
  });
  expect(leased.statusCode, leased.body).toBe(200);
  expect(leased.json().commands).toEqual([
    expect.objectContaining({
      type: "whitelist_add",
      payload: { username: "Auto_Player" },
    }),
  ]);
});
it("asks for and saves a Telegram rejection reason", async () => {
  const { cookie } = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: { okrip_session: cookie },
    headers: browserHeaders,
    payload: { minecraftUsername: "Player_One" },
  });
  const publicId = submitted.json().application.publicId;
  await ctx.worker.tick();
  ctx.telegram.call.mockClear();

  const prompt = await ctx.app.inject({
    method: "POST",
    url: "/v1/integrations/telegram/webhook",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET,
    },
    payload: telegramBody(publicId, "reject"),
  });
  expect(prompt.statusCode).toBe(200);
  expect((await ctx.db.select().from(applications))[0]!.status).toBe("pending");
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({
      text: expect.stringContaining("Схуялє відхилити заявку №1?"),
      reply_markup: expect.objectContaining({ force_reply: true }),
    }),
  );

  const rejected = await ctx.app.inject({
    method: "POST",
    url: "/v1/integrations/telegram/webhook",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET,
    },
    payload: {
      update_id: 2,
      message: {
        message_id: 456,
        text: "Нік не відповідає правилам",
        from: { id: 77, is_bot: false },
        chat: { id: -100 },
        reply_to_message: {
          text: `Схуялє відхилити заявку №1?\n#reject:${publicId}`,
          from: { is_bot: true },
        },
      },
    },
  });
  expect(rejected.statusCode, rejected.body).toBe(200);
  const application = (await ctx.db.select().from(applications))[0]!;
  expect(application.status).toBe("rejected");
  expect(application.rejectionReason).toBe("Нік не відповідає правилам");

  await ctx.worker.tick();
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "editMessageText",
    expect.objectContaining({
      text: expect.stringContaining(
        "❌Статус: Відхилено\n📝Причина: Нік не відповідає правилам",
      ),
      reply_markup: { inline_keyboard: [] },
    }),
  );
});
it("enforces the visible cooldown after rejection and keeps the old Telegram notice", async () => {
  const { cookie } = await login(ctx);
  const cookies = { okrip_session: cookie };
  const submit = () =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/applications",
      cookies,
      headers: browserHeaders,
      payload: { minecraftUsername: "Player_One" },
    });

  const first = await submit();
  expect(first.statusCode).toBe(201);
  expect(first.json().repeatSubmissionEnabled).toBe(false);
  expect(Date.parse(first.json().nextSubmissionAt)).toBeGreaterThan(Date.now());

  await ctx.worker.tick();
  await moderationService(ctx.db, env).decide(
    first.json().application.publicId,
    "reject",
    "77",
    "-100",
    "Тестова відмова",
  );
  await ctx.worker.tick();
  ctx.telegram.call.mockClear();

  const blocked = await submit();
  expect(blocked.statusCode).toBe(429);

  await ctx.db
    .update(applications)
    .set({
      createdAt: new Date(
        Date.now() - APPLICATION_SUBMISSION_COOLDOWN_MS - 1_000,
      ),
    })
    .where(eq(applications.publicId, first.json().application.publicId));
  const applicant = (await ctx.db.select().from(users))[0]!;
  const resubmitted = await applicationService(ctx.db, ctx.discord).submit(
    applicant,
    { minecraftUsername: "Player_One" },
  );
  expect(resubmitted.application?.status).toBe("pending");
  await ctx.worker.tick();
  expect(ctx.telegram.call).not.toHaveBeenCalledWith(
    "deleteMessage",
    expect.anything(),
  );
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({ text: expect.stringContaining("🧾Заявка №2") }),
  );
  const saved = await ctx.db.select().from(applications);
  expect(saved.map((application) => application.status)).toEqual([
    "rejected",
    "pending",
  ]);
});
it("queues a fresh whitelist_add when debug mode reuses existing access", async () => {
  await ctx.close();
  ctx = await setup({ APPLICATION_REPEAT_DEBUG: true });
  const { cookie } = await login(ctx);
  const cookies = { okrip_session: cookie };
  const submit = (minecraftUsername: string) =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/applications",
      cookies,
      headers: browserHeaders,
      payload: { minecraftUsername },
    });

  const first = await submit("First_Player");
  await moderationService(ctx.db, {
    ...env,
    APPLICATION_REPEAT_DEBUG: true,
  }).decide(first.json().application.publicId, "approve", "77", "-100");
  expect(await ctx.db.select().from(commands)).toHaveLength(1);

  const second = await submit("Second_Player");
  await moderationService(ctx.db, {
    ...env,
    APPLICATION_REPEAT_DEBUG: true,
  }).decide(second.json().application.publicId, "approve", "77", "-100");

  const savedCommands = await ctx.db.select().from(commands);
  expect(savedCommands).toHaveLength(2);
  expect(savedCommands[1]!.type).toBe("whitelist_add");
  expect(savedCommands[1]!.payload).toEqual({ username: "Second_Player" });

  const snapshot = await ctx.app.inject({
    method: "POST",
    url: "/v1/minecraft/whitelist/snapshot",
    headers: serverHeaders,
    payload: {},
  });
  expect(snapshot.statusCode, snapshot.body).toBe(200);
  expect(snapshot.json().usernames).toEqual(["Second_Player"]);
});
it("rejects duplicates, forged identity, and unauthorized moderators", async () => {
  const { cookie } = await login(ctx);
  const user = (await ctx.db.select().from(users))[0]!;
  const service = applicationService(ctx.db, ctx.discord);
  await service.submit(user, { minecraftUsername: "Player_One" });
  await expect(
    service.submit(user, { minecraftUsername: "Player_One" }),
  ).rejects.toMatchObject({ code: "application_exists" });
  const other = (
    await ctx.db
      .insert(users)
      .values({ discordId: "222", discordUsername: "other" })
      .returning()
  )[0]!;
  await expect(
    service.submit(other, { minecraftUsername: "pLaYeR_OnE" }),
  ).rejects.toMatchObject({ code: "duplicate_identity" });
  const app = (await ctx.db.select().from(applications))[0]!;
  const response = await ctx.app.inject({
    method: "POST",
    url: "/v1/integrations/telegram/webhook",
    headers: { "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET },
    payload: telegramBody(app.publicId, "approve", 999),
  });
  expect(response.statusCode).toBe(403);
  expect(await ctx.db.select().from(commands)).toHaveLength(0);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/applications",
        cookies: { okrip_session: cookie },
        headers: browserHeaders,
        payload: { minecraftUsername: "GoodName", discord_id: "222" },
      })
    ).statusCode,
  ).toBe(400);
});
it("allows a moderator from the additional Telegram ID list", async () => {
  const { cookie } = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: { okrip_session: cookie },
    headers: browserHeaders,
    payload: { minecraftUsername: "ExtraAdmin" },
  });
  const service = moderationService(ctx.db, {
    ...env,
    TELEGRAM_EXTRA_ADMIN_USER_IDS: "940017502",
  });

  await expect(
    service.decide(
      submitted.json().application.publicId,
      "approve",
      "940017502",
      env.TELEGRAM_ADMIN_CHAT_ID,
    ),
  ).resolves.toBe("approved");
});
it.each(["ab", "has space", "somebody;op", "abcdefghijklmnopq", "Імя"])(
  "rejects nickname %s",
  (name) => {
    expect(minecraftUsernameSchema.safeParse(name).success).toBe(false);
  },
);
