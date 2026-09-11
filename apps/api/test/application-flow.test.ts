import { afterEach, beforeEach, expect, it } from "vitest";
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
import { applicationService } from "../src/modules/applications/application.service.js";
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
  expect(ctx.discord.membership).toHaveBeenCalledWith("111");
  const publicId = submitted.json().application.publicId;
  expect((await ctx.db.select().from(identities))[0]!.normalizedUsername).toBe(
    "player_one",
  );
  await ctx.worker.tick();
  expect(ctx.telegram.call).toHaveBeenCalledWith(
    "sendMessage",
    expect.objectContaining({ text: expect.stringContaining("Player_One") }),
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
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
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
it.each(["ab", "has space", "somebody;op", "abcdefghijklmnopq", "Імя"])(
  "rejects nickname %s",
  (name) => {
    expect(minecraftUsernameSchema.safeParse(name).success).toBe(false);
  },
);
