import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  leaseRequestSchema,
  acknowledgementSchema,
  failureSchema,
  banEventSchema,
  whitelistRemoveEventSchema,
  unbanEventSchema,
} from "@okrip/contracts";
import type { Env } from "../../config/env.js";
import { equalSecret } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { minecraftService } from "./minecraft-command.service.js";
import type { MinecraftCommandSignals } from "./minecraft-command.signal.js";
export function minecraftRoutes(
  app: FastifyInstance,
  env: Env,
  serviceForServer: (serverId: string) => ReturnType<typeof minecraftService>,
  signals: MinecraftCommandSignals,
) {
  const authenticate = async (req: FastifyRequest) => {
    if (
      ![env.MINECRAFT_SERVER_ID, env.APPLICATION_SERVER_ID].includes(
        String(req.headers["x-server-id"]),
      ) ||
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
  app.get(
    "/v1/minecraft/commands/watch",
    { websocket: true, preHandler: authenticate },
    (socket, req) => {
      const serverId = String(req.headers["x-server-id"]);
      let alive = true;
      const sendSignal = () => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: "commands_available" }));
        }
      };
      const unsubscribe = signals.subscribe(serverId, sendSignal);
      const heartbeat = setInterval(() => {
        if (!alive) {
          socket.terminate();
          return;
        }
        alive = false;
        socket.ping();
      }, 45_000);
      heartbeat.unref();
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      socket.on("pong", () => {
        alive = true;
      });
      socket.once("close", cleanup);
      socket.once("error", cleanup);

      // Forces one queue check after every connection or reconnection.
      setImmediate(sendSignal);
    },
  );
  app.post("/v1/minecraft/commands/lease", options, async (req) => {
    leaseRequestSchema.parse(req.body);
    return serviceForServer(String(req.headers["x-server-id"])).lease();
  });
  app.post("/v1/minecraft/whitelist/snapshot", options, async (req) =>
    serviceForServer(String(req.headers["x-server-id"])).whitelistSnapshot(),
  );
  app.post(
    "/v1/minecraft/commands/:id/complete",
    options,
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = acknowledgementSchema.parse(req.body);
      await serviceForServer(String(req.headers["x-server-id"])).acknowledge(
        id,
        body.leaseToken,
      );
      return reply.code(204).send();
    },
  );
  app.post("/v1/minecraft/commands/:id/fail", options, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = failureSchema.parse(req.body);
    await serviceForServer(String(req.headers["x-server-id"])).acknowledge(
      id,
      body.leaseToken,
      body.error,
    );
    return reply.code(204).send();
  });
  app.post("/v1/minecraft/whitelist/remove", options, async (req) =>
    serviceForServer(String(req.headers["x-server-id"])).removeFromWhitelist(
      whitelistRemoveEventSchema.parse(req.body),
    ),
  );
  app.post("/v1/minecraft/unban", options, async (req) =>
    serviceForServer(String(req.headers["x-server-id"])).unban(
      unbanEventSchema.parse(req.body),
    ),
  );
  app.post("/v1/minecraft/events/ban", options, async (req, reply) => {
    await serviceForServer(String(req.headers["x-server-id"])).ban(
      banEventSchema.parse(req.body),
    );
    return reply.code(204).send();
  });
}
