import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  leaseRequestSchema,
  acknowledgementSchema,
  failureSchema,
  banEventSchema,
} from "@okrip/contracts";
import type { Env } from "../../config/env.js";
import { equalSecret } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { minecraftService } from "./minecraft-command.service.js";
export function minecraftRoutes(
  app: FastifyInstance,
  env: Env,
  service: ReturnType<typeof minecraftService>,
) {
  const authenticate = async (req: FastifyRequest) => {
    if (
      req.headers["x-server-id"] !== env.MINECRAFT_SERVER_ID ||
      !equalSecret(
        String(req.headers.authorization ?? ""),
        "Bearer " + env.MINECRAFT_SERVER_TOKEN,
      )
    )
      throw new AppError(401, "unauthorized", "Unauthorized");
  };
  const options = {
    preHandler: authenticate,
    config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
  };
  app.post("/v1/minecraft/commands/lease", options, async (req) => {
    leaseRequestSchema.parse(req.body);
    return service.lease();
  });
  app.post(
    "/v1/minecraft/commands/:id/complete",
    options,
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = acknowledgementSchema.parse(req.body);
      await service.acknowledge(id, body.leaseToken);
      return reply.code(204).send();
    },
  );
  app.post("/v1/minecraft/commands/:id/fail", options, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = failureSchema.parse(req.body);
    await service.acknowledge(id, body.leaseToken, body.error);
    return reply.code(204).send();
  });
  app.post("/v1/minecraft/events/ban", options, async (req, reply) => {
    await service.ban(banEventSchema.parse(req.body));
    return reply.code(204).send();
  });
}
