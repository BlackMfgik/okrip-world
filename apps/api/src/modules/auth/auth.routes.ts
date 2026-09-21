import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import type { AuthService } from "./auth.service.js";
import { sessionCookie } from "../../plugins/auth-session.js";
export function authRoutes(app: FastifyInstance, auth: AuthService, env: Env) {
  const options = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  app.get(
    "/v1/auth/discord/start",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_req, reply) => {
      const result = await auth.start();
      reply.setCookie("okrip_oauth", result.browser, {
        ...options,
        maxAge: 600,
      });
      return reply.redirect(result.url);
    },
  );
  app.get(
    "/v1/auth/discord/callback",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      reply.clearCookie("okrip_oauth", options);
      const parsed = z
        .object({
          code: z.string().min(1).max(2048),
          state: z.string().min(32).max(128),
        })
        .safeParse(req.query);
      if (!parsed.success || !req.cookies.okrip_oauth)
        return reply.redirect(
          env.APP_BASE_URL + "/auth/callback?error=login_failed",
        );
      try {
        const token = await auth.callback(
          parsed.data.code,
          parsed.data.state,
          req.cookies.okrip_oauth,
        );
        await auth.logout(req.cookies[sessionCookie]);
        reply.setCookie(sessionCookie, token, {
          ...options,
          maxAge: 7 * 86400,
        });
        return reply.redirect(env.APP_BASE_URL + "/application");
      } catch {
        return reply.redirect(
          env.APP_BASE_URL + "/auth/callback?error=login_failed",
        );
      }
    },
  );
  app.get("/v1/me", async (req) => {
    const user = await auth.current(req.cookies[sessionCookie]);
    return {
      user: user
        ? {
            username: user.discordUsername,
            displayName: user.discordGlobalName,
            isAdmin: await auth.isAdmin(user.discordId),
          }
        : null,
    };
  });
  app.post("/v1/auth/logout", async (req, reply) => {
    await auth.logout(req.cookies[sessionCookie]);
    reply.clearCookie(sessionCookie, options);
    return reply.code(204).send();
  });
}
