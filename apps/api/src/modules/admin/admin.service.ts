import {
  adminApplicationBlockResultSchema,
  adminApplicationListSchema,
  type AdminApplicationFilter,
  type AdminApplicationBlock,
} from "@okrip/contracts";
import {
  discordMembershipEnricher,
  type DiscordProvider,
} from "../auth/index.js";
import { discordAccountCreatedAt } from "../../shared/discord-account.js";
import { lockUser } from "../player-access/index.js";
import type { moderationService } from "../moderation/index.js";
import { adminAccountsService } from "./admin-accounts.service.js";
import { adminWhitelistService } from "./admin-whitelist.service.js";
import type { Database } from "../../db/client.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import { discordAvatarUrl } from "../../shared/discord-avatar.js";
import type { WebAdmin } from "./admin.types.js";
import * as repo from "./admin.repository.js";

export function adminService(
  db: Database,
  moderation: ReturnType<typeof moderationService>,
  serverId: string,
  commandQueued: (serverId: string) => void = () => undefined,
  discord?: DiscordProvider,
) {
  const enrichMembership = discord
    ? discordMembershipEnricher(db, discord)
    : undefined;
  return {
    ...adminAccountsService(db),
    ...adminWhitelistService(db, serverId, commandQueued),
    async list(filter: AdminApplicationFilter) {
      const [allRows, groupedCounts, blockedCount] = await Promise.all([
        repo.listApplications(db, filter),
        repo.applicationCounts(db),
        repo.blockedUserCount(db),
      ]);
      // У «Заблокованих» — по одному рядку на гравця: його остання заявка.
      const seenUsers = new Set<string>();
      const rows =
        filter === "blocked"
          ? allRows.filter(({ user }) => {
              if (seenUsers.has(user.id)) return false;
              seenUsers.add(user.id);
              return true;
            })
          : allRows;
      const joinedDates = await enrichMembership?.(
        rows.map(({ user }) => user),
      );
      const counts = {
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        blocked: Number(blockedCount),
      };
      const now = Date.now();
      for (const row of groupedCounts) {
        counts[row.status] = Number(row.count);
        counts.all += Number(row.count);
      }
      return adminApplicationListSchema.parse({
        applications: rows.map(({ application, identity, user }) => {
          const blocked =
            Boolean(user.applicationBlockedAt) &&
            (!user.applicationBlockedUntil ||
              user.applicationBlockedUntil.getTime() > now);
          return {
            publicId: application.publicId,
            number: application.number,
            discordUsername: user.discordUsername,
            discordAccountCreatedAt: discordAccountCreatedAt(user.discordId),
            discordGuildJoinedAt:
              (
                user.discordGuildJoinedAt ?? joinedDates?.get(user.id)
              )?.toISOString() ?? null,
            discordDisplayName: user.discordGlobalName,
            discordAvatarUrl: discordAvatarUrl(
              user.discordId,
              user.discordAvatar,
            ),
            minecraftUsername: identity.username,
            applicationBlocked: blocked,
            applicationBlockedUntil:
              blocked && user.applicationBlockedUntil
                ? user.applicationBlockedUntil.toISOString()
                : null,
            status: application.status,
            rejectionReason: application.rejectionReason,
            reviewerName: application.reviewedByTelegramName,
            createdAt: application.createdAt.toISOString(),
            reviewedAt: application.reviewedAt?.toISOString() ?? null,
          };
        }),
        counts,
      });
    },
    async setApplicationBlocked(input: AdminApplicationBlock, admin: WebAdmin) {
      const blockedUntil =
        input.blocked && input.durationMinutes
          ? new Date(Date.now() + input.durationMinutes * 60_000)
          : null;
      await db.transaction(async (tx) => {
        const found = await repo.applicationUserByPublicId(tx, input.publicId);
        if (!found) throw new AppError(404, "not_found", "Заявку не знайдено.");
        await lockUser(tx, found.user.id);
        await repo.setApplicationBlocked(
          tx,
          found.user.id,
          input.blocked ? admin.discordId : null,
          blockedUntil,
        );
        await audit(tx, {
          actorType: "user",
          actorId: admin.id,
          eventType: input.blocked
            ? blockedUntil
              ? "application_user_temporarily_blocked"
              : "application_user_blocked"
            : "application_user_unblocked",
          entityType: "user",
          entityId: found.user.id,
          metadata: {
            applicationPublicId: input.publicId,
            actorDiscordId: admin.discordId,
            blockedUntil: blockedUntil?.toISOString() ?? null,
          },
        });
      });
      return adminApplicationBlockResultSchema.parse({
        publicId: input.publicId,
        applicationBlocked: input.blocked,
        applicationBlockedUntil: blockedUntil?.toISOString() ?? null,
      });
    },
    decide: moderation.decideAsWebAdmin,
  };
}
