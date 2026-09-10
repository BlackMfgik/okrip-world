import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import type { applicationService } from "./application.service.js";
import { requireUser } from "../../plugins/auth-session.js";
import { submitApplicationSchema } from "@okrip/contracts";
export function applicationRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: ReturnType<typeof applicationService>,
) {
  app.post(
    "/v1/applications",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await service.submit(
            await requireUser(auth, req),
            submitApplicationSchema.parse(req.body),
          ),
        ),
  );
  app.get("/v1/applications/current", async (req) =>
    service.current((await requireUser(auth, req)).id),
  );
}
