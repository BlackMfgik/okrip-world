import { testDatabase } from "./test-database.js";
import { vi } from "vitest";
import { envSchema } from "../src/config/env.js";
import { buildApp } from "../src/app.js";
import type {
  DiscordIdentity,
  DiscordMembership,
} from "../src/modules/auth/index.js";
import type { DiscordMessage } from "../src/modules/discord/index.js";
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
  APPLICATION_SERVER_ID: "vanilla",
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
    membership: vi.fn(async (): Promise<DiscordMembership> => ({
      joinedAt: new Date("2026-09-01T10:20:30.000Z"),
    })),
  };
  const telegram = { call: vi.fn(async () => ({ message_id: 123 })) };
  const discordBot = {
    guildRoles: vi.fn(async () => [
      {
        id: "456",
        name: "@everyone",
        permissions: "0",
        managed: false,
        position: 0,
      },
      {
        id: "20000000000000001",
        name: "Гравець",
        permissions: "0",
        managed: false,
        position: 1,
      },
      {
        id: "20000000000000002",
        name: "Модератор",
        permissions: "8",
        managed: false,
        position: 2,
      },
      {
        id: "20000000000000003",
        name: "Okrip Bot",
        permissions: "268435456",
        managed: true,
        position: 3,
      },
      {
        id: "20000000000000004",
        name: "Власник",
        permissions: "0",
        managed: false,
        position: 4,
      },
    ]),
    guildChannels: vi.fn(async () => [
      { id: "10000000000000009", name: "Інфо", type: 4, position: 1 },
      { id: "10000000000000008", name: "Чат", type: 4, position: 0 },
      {
        id: "10000000000000001",
        name: "правила",
        type: 0,
        position: 0,
        parent_id: "10000000000000009",
      },
      {
        id: "10000000000000002",
        name: "загальний",
        type: 0,
        position: 0,
        parent_id: "10000000000000008",
      },
      {
        id: "10000000000000003",
        name: "голосовий",
        type: 2,
        position: 1,
        parent_id: "10000000000000008",
      },
      { id: "10000000000000004", name: "новини", type: 5, position: 0 },
    ]),
    botRoleIds: vi.fn(async (): Promise<string[] | null> => [
      "20000000000000003",
    ]),
    postMessage: vi.fn(async () => ({ status: 200, id: "30000000000000001" })),
    getMessage: vi.fn(
      async (
        channelId: string,
        messageId: string,
      ): Promise<{ status: number; message?: DiscordMessage }> => ({
        status: 200,
        message: {
          id: messageId,
          channel_id: channelId,
          content: "Натисніть, щоб отримати роль гравця",
          flags: 4,
          author: { id: "123" },
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: "Отримати роль",
                  custom_id: "role:20000000000000001",
                },
              ],
            },
          ],
        },
      }),
    ),
    editMessage: vi.fn(async () => 200),
    setMemberRole: vi.fn(async () => 204),
  };
  const { app, worker } = await buildApp(activeEnv, db, {
    discord,
    telegram,
    discordBot,
  });
  return {
    db,
    app,
    worker,
    discord,
    telegram,
    discordBot,
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
