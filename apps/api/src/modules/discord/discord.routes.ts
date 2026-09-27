import type { FastifyInstance } from "fastify";
import { adminDiscordRoleMessageSchema } from "@okrip/contracts";
import { AppError } from "../../shared/errors.js";
import { requireSuperAdmin } from "../../plugins/auth-session.js";
import type { AuthService } from "../auth/auth.service.js";
import type { discordRolesService } from "./discord-roles.service.js";

type WithRawBody = { rawBody?: string };

export function discordRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: ReturnType<typeof discordRolesService>,
) {
  app.post(
    "/v1/admin/discord/role-message",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) =>
      service.postRoleMessage(
        adminDiscordRoleMessageSchema.parse(req.body),
        await requireSuperAdmin(auth, req),
      ),
  );

  // Interactions Endpoint URL застосунку в Discord Developer Portal. Підпис рахується від сирого тіла,
  // тому в цьому scope JSON розбирається вручну.
  app.register(async (scope) => {
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (req, body, done) => {
        (req as WithRawBody).rawBody = body as string;
        try {
          done(null, JSON.parse(body as string));
        } catch {
          done(new AppError(400, "invalid_request", "Некоректний JSON."));
        }
      },
    );
    scope.post(
      "/v1/integrations/discord/interactions",
      { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
      async (req, reply) => {
        if (!service.interactionsConfigured())
          throw new AppError(
            503,
            "discord_interactions_disabled",
            "DISCORD_PUBLIC_KEY не задано.",
          );
        const valid = service.verifySignature(
          String(req.headers["x-signature-ed25519"] ?? ""),
          String(req.headers["x-signature-timestamp"] ?? ""),
          (req as WithRawBody).rawBody ?? "",
        );
        if (!valid)
          return reply.code(401).send({ message: "Invalid signature" });
        return service.handleInteraction(req.body);
      },
    );
  });
}
