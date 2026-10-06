import {
  adminAccountListSchema,
  adminAccountMutationResultSchema,
  type AdminAccountMutation,
} from "@okrip/contracts";
import { isSuperAdmin } from "../../shared/super-admin.js";
import type { Database } from "../../db/client.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import { discordAvatarUrl } from "../../shared/discord-avatar.js";
import type { WebAdmin } from "./admin.types.js";
import * as repo from "./admin.repository.js";

export function adminAccountsService(db: Database) {
  return {
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
      if (target.discordId === admin.discordId)
        throw new AppError(403, "protected_admin", "Не можна видалити себе.");
      // Головних модерів може видалити лише супер-адмін.
      if (target.canManageAdmins && !isSuperAdmin(admin.discordId))
        throw new AppError(
          403,
          "protected_admin",
          "Головного модератора не можна видалити.",
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
  };
}
