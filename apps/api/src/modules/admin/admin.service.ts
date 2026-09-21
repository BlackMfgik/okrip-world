import {
  adminApplicationListSchema,
  type AdminApplicationFilter,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import type { moderationService } from "../moderation/moderation.service.js";
import * as repo from "./admin.repository.js";

export function adminService(
  db: Database,
  moderation: ReturnType<typeof moderationService>,
) {
  return {
    async list(filter: AdminApplicationFilter) {
      const [rows, groupedCounts] = await Promise.all([
        repo.listApplications(db, filter),
        repo.applicationCounts(db),
      ]);
      const counts = {
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      };
      for (const row of groupedCounts) {
        counts[row.status] = Number(row.count);
        counts.all += Number(row.count);
      }
      return adminApplicationListSchema.parse({
        applications: rows.map(({ application, identity, user }) => ({
          publicId: application.publicId,
          number: application.number,
          discordUsername: user.discordUsername,
          discordDisplayName: user.discordGlobalName,
          minecraftUsername: identity.username,
          status: application.status,
          rejectionReason: application.rejectionReason,
          reviewerName: application.reviewedByTelegramName,
          createdAt: application.createdAt.toISOString(),
          reviewedAt: application.reviewedAt?.toISOString() ?? null,
        })),
        counts,
      });
    },
    decide: moderation.decideAsWebAdmin,
  };
}
