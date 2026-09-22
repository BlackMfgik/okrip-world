import type { FastifyInstance } from "fastify";
import {
  adminAccountMutationSchema,
  adminApplicationBlockSchema,
  adminApplicationFilterSchema,
  adminDecisionSchema,
  adminWhitelistAddSchema,
  adminWhitelistRemoveSchema,
} from "@okrip/contracts";
import {
  requireAdmin,
  requireAdminManager,
} from "../../plugins/auth-session.js";
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

  app.get("/v1/admin/whitelist", async (req) => {
    await requireAdmin(auth, req);
    return service.whitelist();
  });

  app.get("/v1/admin/accounts", async (req) => {
    await requireAdminManager(auth, req);
    return service.accounts();
  });

  app.post(
    "/v1/admin/accounts/add",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) =>
      service.addAdmin(
        adminAccountMutationSchema.parse(req.body),
        await requireAdminManager(auth, req),
      ),
  );

  app.post(
    "/v1/admin/accounts/remove",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) =>
      service.removeAdmin(
        adminAccountMutationSchema.parse(req.body),
        await requireAdminManager(auth, req),
      ),
  );

  app.post(
    "/v1/admin/whitelist/add",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const admin = await requireAdmin(auth, req);
      return service.addToWhitelist(
        adminWhitelistAddSchema.parse(req.body),
        admin,
      );
    },
  );

  app.post(
    "/v1/admin/whitelist/remove",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const admin = await requireAdmin(auth, req);
      const input = adminWhitelistRemoveSchema.parse(req.body);
      return service.removeFromWhitelist(input.accessId, admin);
    },
  );

  app.post(
    "/v1/admin/applications/block",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) =>
      service.setApplicationBlocked(
        adminApplicationBlockSchema.parse(req.body),
        await requireAdmin(auth, req),
      ),
  );

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
