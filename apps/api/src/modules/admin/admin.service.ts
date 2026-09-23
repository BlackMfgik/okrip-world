import {
  adminAccountListSchema,
  adminAccountMutationResultSchema,
  adminApplicationBlockResultSchema,
  adminApplicationListSchema,
  adminWhitelistSchema,
  type AdminWhitelistAdd,
  type AdminApplicationFilter,
  type AdminAccountMutation,
  type AdminApplicationBlock,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import { AppError } from "../../shared/errors.js";
import { discordAvatarUrl } from "../../shared/discord-avatar.js";
import { audit } from "../audit/audit.repository.js";
import { lockUser } from "../applications/application.repository.js";
import { addCommand } from "../moderation/moderation.repository.js";
import type { moderationService } from "../moderation/moderation.service.js";
import * as repo from "./admin.repository.js";

interface WebAdmin {
  id: string;
  discordId: string;
  discordUsername: string;
  discordGlobalName: string | null;
}

export function adminService(
  db: Database,
  moderation: ReturnType<typeof moderationService>,
  serverId: string,
  commandQueued: (serverId: string) => void = () => undefined,
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
    async whitelist() {
      const rows = await repo.listWhitelistPlayers(db);
      return adminWhitelistSchema.parse({
        players: rows.map(({ access, identity, user }) => ({
          accessId: access.id,
          minecraftUsername: identity.username,
          discordUsername: user.discordUsername,
          discordDisplayName: user.discordGlobalName,
          discordId: user.discordId,
          discordAvatarUrl: discordAvatarUrl(
            user.discordId,
            user.discordAvatar,
          ),
          addedAt: access.createdAt.toISOString(),
        })),
        count: rows.length,
      });
    },
    async accounts() {
      const rows = await repo.listAdminAccounts(db);
      return adminAccountListSchema.parse({
        accounts: rows.map(({ account, user }) => ({
          discordId: account.discordId,
          discordUsername: user?.discordUsername ?? null,
          discordDisplayName: user?.discordGlobalName ?? null,
          discordAvatarUrl: discordAvatarUrl(
            account.discordId,
            user?.discordAvatar ?? null,
          ),
          canManageAdmins: account.canManageAdmins,
          createdAt: account.createdAt.toISOString(),
        })),
        count: rows.length,
      });
    },
    async addAdmin(input: AdminAccountMutation, admin: WebAdmin) {
      if (await repo.adminAccountByDiscordId(db, input.discordId))
        throw new AppError(
          409,
          "admin_exists",
          "Цей Discord уже має права адміністратора.",
        );
      try {
        await db.transaction(async (tx) => {
          await repo.createAdminAccount(tx, input.discordId);
          await audit(tx, {
            actorType: "user",
            actorId: admin.id,
            eventType: "web_admin_added",
            entityType: "admin_account",
            entityId: admin.id,
            metadata: {
              targetDiscordId: input.discordId,
              actorDiscordId: admin.discordId,
            },
          });
        });
      } catch (error) {
        const cause = error as { code?: string; cause?: { code?: string } };
        if (cause.code === "23505" || cause.cause?.code === "23505")
          throw new AppError(
            409,
            "admin_exists",
            "Цей Discord уже має права адміністратора.",
          );
        throw error;
      }
      return adminAccountMutationResultSchema.parse({
        discordId: input.discordId,
      });
    },
    async removeAdmin(input: AdminAccountMutation, admin: WebAdmin) {
      const target = await repo.adminAccountByDiscordId(db, input.discordId);
      if (!target)
        throw new AppError(404, "not_found", "Адміністратора не знайдено.");
      if (target.canManageAdmins)
        throw new AppError(
          403,
          "protected_admin",
          "Власника адмін-панелі не можна видалити.",
        );
      await db.transaction(async (tx) => {
        await repo.deleteAdminAccount(tx, input.discordId);
        await audit(tx, {
          actorType: "user",
          actorId: admin.id,
          eventType: "web_admin_removed",
          entityType: "admin_account",
          entityId: admin.id,
          metadata: {
            targetDiscordId: input.discordId,
            actorDiscordId: admin.discordId,
          },
        });
      });
      return adminAccountMutationResultSchema.parse({
        discordId: input.discordId,
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
    async addToWhitelist(input: AdminWhitelistAdd, admin: WebAdmin) {
      const discordUsername = input.discordUsername.replace(/^@/, "");
      let result;
      try {
        result = await db.transaction(async (tx) => {
          const user =
            (await repo.userByDiscordId(tx, input.discordId)) ??
            (await repo.createUser(tx, input.discordId, discordUsername));
          await lockUser(tx, user.id);

          const [ownedIdentity, namedIdentity] = await Promise.all([
            repo.identityByUserId(tx, user.id),
            repo.identityByName(tx, input.minecraftUsername),
          ]);
          if (
            ownedIdentity &&
            ownedIdentity.normalizedUsername !==
              input.minecraftUsername.toLowerCase()
          )
            throw new AppError(
              409,
              "discord_identity_exists",
              "Цей Discord уже прив’язаний до іншого Minecraft-ніка.",
            );
          if (namedIdentity && namedIdentity.userId !== user.id)
            throw new AppError(
              409,
              "minecraft_identity_exists",
              "Цей Minecraft-нік уже прив’язаний до іншого Discord.",
            );
          const identity =
            ownedIdentity ??
            namedIdentity ??
            (await repo.createIdentity(tx, user.id, input.minecraftUsername));
          const existingAccess = await repo.accessByUserId(tx, user.id);
          if (existingAccess?.status === "banned")
            throw new AppError(
              409,
              "access_banned",
              "Гравець заблокований. Спочатку потрібне окреме рішення щодо бану.",
            );
          if (existingAccess?.status === "active")
            throw new AppError(
              409,
              "access_exists",
              "Гравець уже є у вайтлісті.",
            );
          if (existingAccess?.status === "revoked")
            await repo.allowAccessRestoration(tx);
          const access = existingAccess
            ? await repo.setAccessStatus(tx, existingAccess.id, "active")
            : await repo.createAccess(tx, user.id, identity.id);
          await addCommand(
            tx,
            access.id,
            serverId,
            identity.username,
            "whitelist_add",
          );
          await audit(tx, {
            actorType: "user",
            actorId: admin.id,
            eventType: "whitelist_player_added",
            entityType: "player_access",
            entityId: access.id,
            metadata: { source: "web_admin", discordId: admin.discordId },
          });
          return access;
        });
      } catch (error) {
        const cause = error as { code?: string; cause?: { code?: string } };
        if (cause.code === "23505" || cause.cause?.code === "23505")
          throw new AppError(
            409,
            "whitelist_identity_conflict",
            "Discord ID або Minecraft-нік уже використовується.",
          );
        throw error;
      }
      commandQueued(serverId);
      return {
        accessId: result.id,
        status: result.status,
        synchronization: "waiting" as const,
      };
    },
    async removeFromWhitelist(accessId: string, admin: WebAdmin) {
      const result = await db.transaction(async (tx) => {
        const found = await repo.accessById(tx, accessId);
        if (!found) throw new AppError(404, "not_found", "Гравця не знайдено.");
        await lockUser(tx, found.user.id);
        const fresh = await repo.accessById(tx, accessId);
        if (!fresh) throw new AppError(404, "not_found", "Гравця не знайдено.");
        if (fresh.access.status !== "active")
          throw new AppError(
            409,
            "access_not_active",
            "Гравець уже не має активного доступу.",
          );
        const access = await repo.setAccessStatus(tx, accessId, "revoked");
        await addCommand(
          tx,
          access.id,
          serverId,
          fresh.identity.username,
          "whitelist_remove",
        );
        await audit(tx, {
          actorType: "user",
          actorId: admin.id,
          eventType: "whitelist_player_removed",
          entityType: "player_access",
          entityId: access.id,
          metadata: { source: "web_admin", discordId: admin.discordId },
        });
        return access;
      });
      commandQueued(serverId);
      return {
        accessId: result.id,
        status: result.status,
        synchronization: "waiting" as const,
      };
    },
    decide: moderation.decideAsWebAdmin,
  };
}
