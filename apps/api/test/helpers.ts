import { testDatabase } from "./test-database.js";
import { vi } from "vitest";
import { envSchema } from "../src/config/env.js";
import { buildApp } from "../src/app.js";
import type { DiscordIdentity } from "../src/modules/auth/discord.service.js";
export const env = envSchema.parse({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://test",
  APP_BASE_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:3000",
  SESSION_SECRET: "s".repeat(32),
  WEB_PROXY_SECRET: "p".repeat(32),
  DISCORD_CLIENT_ID: "123",
  DISCORD_CLIENT_SECRET: "secret",
  DISCORD_REDIRECT_URI: "http://localhost:3000/v1/auth/discord/callback",
  DISCORD_BOT_TOKEN: "bot",
  DISCORD_GUILD_ID: "456",
  TELEGRAM_BOT_TOKEN: "bot",
  TELEGRAM_WEBHOOK_SECRET: "t".repeat(32),
  TELEGRAM_ADMIN_CHAT_ID: "-100",
  TELEGRAM_ADMIN_USER_IDS: "77",
  MINECRAFT_SERVER_ID: "vanilla",
  MINECRAFT_SERVER_TOKEN: "m".repeat(32),
});
export async function setup(overrides: Partial<typeof env> = {}) {
  const database = await testDatabase();
  const db = database.db;
  const activeEnv = { ...env, ...overrides };
  const discord = {
    identity: vi.fn(async (): Promise<DiscordIdentity> => ({
      id: "111",
      username: "DiscordName",
      global_name: null,
      avatar: null,
    })),
    membership: vi.fn(async () => {}),
  };
  const telegram = { call: vi.fn(async () => ({ message_id: 123 })) };
  const { app, worker } = await buildApp(activeEnv, db, { discord, telegram });
  return {
    db,
    app,
    worker,
    discord,
    telegram,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}
export async function login(ctx: Awaited<ReturnType<typeof setup>>) {
  const start = await ctx.app.inject({ url: "/v1/auth/discord/start" });
  const state = new URL(start.headers.location!).searchParams.get("state");
  const browser = start.cookies.find((c) => c.name === "okrip_oauth")!.value;
  const callback = await ctx.app.inject({
    url: "/v1/auth/discord/callback?code=valid&state=" + state,
    cookies: { okrip_oauth: browser },
  });
  return {
    callback,
    state,
    browser,
    cookie: callback.cookies.find((c) => c.name === "okrip_session")!.value,
  };
}
export const browserHeaders = { origin: env.WEB_ORIGIN };
export const serverHeaders = {
  authorization: "Bearer " + env.MINECRAFT_SERVER_TOKEN,
  "x-server-id": env.MINECRAFT_SERVER_ID,
};
export function telegramBody(
  publicId: string,
  action = "approve",
  adminId = 77,
) {
  return {
    update_id: 1,
    callback_query: {
      id: "callback",
      from: { id: adminId, username: "Moderator" },
      data: action + ":" + publicId,
      message: { message_id: 123, chat: { id: -100 } },
    },
  };
}
