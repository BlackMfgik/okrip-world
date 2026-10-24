import { rateLimitKey } from "./plugins/rate-limit.js";
import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { sql } from "drizzle-orm";
import type { Database } from "./db/client.js";
import type { Env } from "./config/env.js";
import { AppError } from "./shared/errors.js";
import { authService } from "./modules/auth/index.js";
import { discordProvider, type DiscordProvider } from "./modules/auth/index.js";
import { authRoutes } from "./modules/auth/index.js";
import { applicationService } from "./modules/applications/index.js";
import { applicationRoutes } from "./modules/applications/index.js";
import { moderationService } from "./modules/moderation/index.js";
import {
  telegramProvider,
  type TelegramProvider,
} from "./modules/moderation/index.js";
import { telegramRoutes } from "./modules/moderation/index.js";
import { telegramWorker } from "./modules/moderation/index.js";
import { minecraftService } from "./modules/minecraft/index.js";
import { minecraftRoutes } from "./modules/minecraft/index.js";
import { MinecraftCommandSignals } from "./modules/minecraft/index.js";
import { adminService } from "./modules/admin/index.js";
import { adminRoutes } from "./modules/admin/index.js";
import { discordBot, type DiscordBot } from "./modules/discord/index.js";
import { discordRolesService } from "./modules/discord/index.js";
import { discordRoutes } from "./modules/discord/index.js";
export async function buildApp(
  env: Env,
  db: Database,
  providers: {
    discord?: DiscordProvider;
    telegram?: TelegramProvider;
    discordBot?: DiscordBot;
  } = {},
) {
  const app = Fastify({
    bodyLimit: 16384,
    logController: new LogController({ disableRequestLogging: true }),
    logger:
      env.NODE_ENV !== "test"
        ? {
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.url",
              'res.headers["set-cookie"]',
            ],
          }
        : false,
  });
  await app.register(websocket, {
    options: { maxPayload: 1024, perMessageDeflate: false },
  });
  await app.register(cookie);
  await app.register(cors, { origin: [env.WEB_ORIGIN], credentials: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => rateLimitKey(env, request),
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    // Кожна POST-мутація з браузера має прийти з origin сайту. Виняток — інтеграції,
    // що приходять не з браузера й автентифікуються власним секретом або підписом.
    const route = req.routeOptions.url;
    if (
      req.method === "POST" &&
      route !== undefined &&
      !route.startsWith("/v1/integrations/") &&
      !route.startsWith("/v1/minecraft/") &&
      req.headers.origin !== env.WEB_ORIGIN
    )
      throw new AppError(403, "invalid_origin", "Запит заблоковано.");
  });
  app.setErrorHandler((error, req, reply) => {
    const httpError = error as { statusCode?: number };
    const status =
      error instanceof AppError
        ? error.statusCode
        : error instanceof ZodError
          ? 400
          : typeof httpError.statusCode === "number" &&
              httpError.statusCode! < 500
            ? httpError.statusCode!
            : 500;
    if (status >= 500)
      app.log.error({ requestId: req.id, status }, "Request failed");
    reply.code(status).send({
      code:
        error instanceof AppError
          ? error.code
          : status === 400
            ? "invalid_request"
            : "request_failed",
      message:
        error instanceof AppError
          ? error.message
          : status === 400
            ? "Перевірте введені дані."
            : "Не вдалося виконати запит. Спробуйте пізніше.",
    });
  });
  const discord = providers.discord ?? discordProvider(env),
    telegram = providers.telegram ?? telegramProvider(env),
    commandSignals = new MinecraftCommandSignals();
  const auth = authService(db, env, discord),
    worker = telegramWorker(db, env, telegram),
    moderation = moderationService(db, env, (serverId) =>
      commandSignals.notify(serverId),
    );
  authRoutes(app, auth, env);
  applicationRoutes(
    app,
    auth,
    applicationService(
      db,
      discord,
      env.APPLICATION_REPEAT_DEBUG,
      env.APPLICATION_AUTO_APPROVE,
      env.APPLICATION_SERVER_ID,
      env.DISCORD_MEMBERSHIP_CHECK,
      (serverId) => commandSignals.notify(serverId),
    ),
  );
  telegramRoutes(app, env, moderation, telegram);
  adminRoutes(
    app,
    auth,
    adminService(
      db,
      moderation,
      env.MINECRAFT_SERVER_ID,
      (serverId) => commandSignals.notify(serverId),
      discord,
    ),
  );
  discordRoutes(
    app,
    auth,
    discordRolesService(db, env, providers.discordBot ?? discordBot(env)),
  );
  minecraftRoutes(
    app,
    env,
    (serverId) =>
      minecraftService(db, serverId, (serverId) =>
        commandSignals.notify(serverId),
      ),
    commandSignals,
  );
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => {
    await db.execute(sql`select 1`);
    return { ok: true };
  });
  return { app, worker };
}
