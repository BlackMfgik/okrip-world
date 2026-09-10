import { expect, test, vi } from "vitest";
import Fastify from "fastify";
import { env } from "./helpers.js";
import { envSchema } from "../src/config/env.js";
import { telegramRoutes } from "../src/modules/moderation/telegram.routes.js";
import { moderationService } from "../src/modules/moderation/moderation.service.js";
import { telegramWorker } from "../src/modules/moderation/telegram-worker.service.js";
import type { Database } from "../src/db/client.js";

test("setup accepts missing IDs, denies moderation and leaves queued jobs untouched", async () => {
  const setupEnv = envSchema.parse({ ...env, TELEGRAM_ADMIN_CHAT_ID: undefined, TELEGRAM_ADMIN_USER_IDS: undefined });
  const transaction = vi.fn();
  const db = { transaction } as unknown as Database;
  const telegram = { call: vi.fn(async () => ({})) };
  await expect(moderationService(db, setupEnv).decide("test", "approve", "77", "-100")).rejects.toMatchObject({ statusCode: 403 });
  await telegramWorker(db, setupEnv, telegram).tick();
  expect(transaction).not.toHaveBeenCalled();
  expect(telegram.call).not.toHaveBeenCalled();
});

test("authenticated setup command returns IDs; unauthorized webhook cannot send messages", async () => {
  const setupEnv = envSchema.parse({ ...env, TELEGRAM_ADMIN_CHAT_ID: "", TELEGRAM_ADMIN_USER_IDS: "" });
  const app = Fastify();
  const telegram = { call: vi.fn(async () => ({})) };
  telegramRoutes(app, setupEnv, moderationService({} as Database, setupEnv), telegram);
  const payload = { update_id: 1, message: { text: "/ids@OkripBot", from: { id: 77 }, chat: { id: -100 } } };
  try {
    const denied = await app.inject({ method: "POST", url: "/v1/integrations/telegram/webhook", payload });
    expect(denied.statusCode).toBe(401);
    expect(telegram.call).not.toHaveBeenCalled();
    const response = await app.inject({ method: "POST", url: "/v1/integrations/telegram/webhook", payload, headers: { "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET } });
    expect(response.statusCode).toBe(200);
    expect(telegram.call).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: -100, text: expect.stringContaining("TELEGRAM_ADMIN_USER_IDS=77") }));
  } finally { await app.close(); }
});
