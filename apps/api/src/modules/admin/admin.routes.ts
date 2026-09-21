import type { FastifyInstance } from "fastify";
import {
  adminApplicationFilterSchema,
  adminDecisionSchema,
} from "@okrip/contracts";
import { requireAdmin } from "../../plugins/auth-session.js";
import type { AuthService } from "../auth/auth.service.js";
import type { adminService } from "./admin.service.js";

export function adminRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: ReturnType<typeof adminService>,
) {
  app.get("/v1/admin/applications", async (req) => {
    await requireAdmin(auth, req);
    const query = req.query as { status?: string };
    const filter = adminApplicationFilterSchema.parse(query.status ?? "all");
    return service.list(filter);
  });

  app.post(
    "/v1/admin/applications/decision",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => {
      const admin = await requireAdmin(auth, req);
      const input = adminDecisionSchema.parse(req.body);
      return {
        status: await service.decide(
          input.publicId,
          input.action,
          admin,
          input.rejectionReason,
        ),
      };
    },
  );
}
