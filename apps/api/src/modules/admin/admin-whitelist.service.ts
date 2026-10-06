import {
  adminWhitelistSchema,
  type AdminWhitelistAdd,
  type AdminWhitelistRename,
} from "@okrip/contracts";
import { lockUser } from "../player-access/index.js";
import * as playerAccess from "../player-access/index.js";
import { enqueueCommand } from "../command-queue/index.js";
import type { Database } from "../../db/client.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import { discordAvatarUrl } from "../../shared/discord-avatar.js";
import type { WebAdmin } from "./admin.types.js";
import * as repo from "./admin.repository.js";

const ADMIN_MINECRAFT_ACCOUNT_LIMIT = 2;
export function adminWhitelistService(
  db: Database,
  serverId: string,
  commandQueued: (serverId: string) => void,
) {
  return {
    async whitelist() {
      const rows = await playerAccess.listWhitelistPlayers(db);
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
    async addToWhitelist(input: AdminWhitelistAdd, admin: WebAdmin) {
      const discordUsername = input.discordUsername.replace(/^@/, "");
      let result;
      try {
        result = await db.transaction(async (tx) => {
          const user =
            (await playerAccess.userByDiscordId(tx, input.discordId)) ??
            (await playerAccess.createUser(
              tx,
              input.discordId,
              discordUsername,
            ));
          await lockUser(tx, user.id);

          const [ownedIdentities, namedIdentity, accesses] = await Promise.all([
            playerAccess.identitiesByUserId(tx, user.id),
            playerAccess.identityByName(tx, input.minecraftUsername),
            playerAccess.accessesByUserId(tx, user.id),
          ]);
          if (namedIdentity && namedIdentity.userId !== user.id)
            throw new AppError(
              409,
              "minecraft_identity_exists",
              "Цей Minecraft-нік уже прив’язаний до іншого Discord.",
            );
          if (!namedIdentity) {
            // Другий Minecraft-акаунт дозволено лише адмінам сайту; той самий ліміт тримає тригер guard_identity_limit.
            const isAdmin = Boolean(
              await repo.adminAccountByDiscordId(tx, input.discordId),
            );
            if (
              ownedIdentities.length >=
              (isAdmin ? ADMIN_MINECRAFT_ACCOUNT_LIMIT : 1)
            )
              throw new AppError(
                409,
                "discord_identity_exists",
                isAdmin
                  ? "Адміністратор уже має два Minecraft-акаунти."
                  : "Цей Discord уже прив’язаний до іншого Minecraft-ніка.",
              );
          }
          if (accesses.some((access) => access.status === "banned"))
            throw new AppError(
              409,
              "access_banned",
              "Гравець заблокований. Спочатку потрібне окреме рішення щодо бану.",
            );
          const identity =
            namedIdentity ??
            (await playerAccess.createIdentity(
              tx,
              user.id,
              input.minecraftUsername,
            ));
          const existingAccess = accesses.find(
            (access) => access.minecraftIdentityId === identity.id,
          );
          if (existingAccess?.status === "active")
            throw new AppError(
              409,
              "access_exists",
              "Гравець уже є у вайтлісті.",
            );
          const access = existingAccess
            ? await playerAccess.restoreAccess(tx, existingAccess.id)
            : await playerAccess.grant(tx, user.id, identity.id);
          await enqueueCommand(
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
    async renamePlayer(input: AdminWhitelistRename, admin: WebAdmin) {
      let result;
      try {
        result = await db.transaction(async (tx) => {
          const found = await playerAccess.accessById(tx, input.accessId);
          if (!found)
            throw new AppError(404, "not_found", "Гравця не знайдено.");
          await lockUser(tx, found.user.id);
          const fresh = await playerAccess.accessById(tx, input.accessId);
          if (!fresh)
            throw new AppError(404, "not_found", "Гравця не знайдено.");
          if (fresh.access.status !== "active")
            throw new AppError(
              409,
              "access_not_active",
              "Гравець уже не має активного доступу.",
            );
          const oldUsername = fresh.identity.username;
          if (oldUsername === input.minecraftUsername)
            throw new AppError(
              409,
              "nickname_unchanged",
              "Гравець уже має цей нік.",
            );
          const taken = await playerAccess.identityByName(
            tx,
            input.minecraftUsername,
          );
          if (taken && taken.id !== fresh.identity.id)
            throw new AppError(
              409,
              "minecraft_identity_exists",
              "Цей Minecraft-нік уже прив’язаний до іншого Discord.",
            );
          await playerAccess.renameIdentity(
            tx,
            fresh.identity.id,
            input.minecraftUsername,
          );
          // Зміна лише регістру не потребує оновлення вайтліста на сервері.
          const nameChanged =
            oldUsername.toLowerCase() !== input.minecraftUsername.toLowerCase();
          if (nameChanged) {
            await enqueueCommand(
              tx,
              fresh.access.id,
              serverId,
              oldUsername,
              "whitelist_remove",
            );
            await enqueueCommand(
              tx,
              fresh.access.id,
              serverId,
              input.minecraftUsername,
              "whitelist_add",
            );
          }
          await audit(tx, {
            actorType: "user",
            actorId: admin.id,
            eventType: "whitelist_player_renamed",
            entityType: "player_access",
            entityId: fresh.access.id,
            metadata: {
              source: "web_admin",
              discordId: admin.discordId,
              oldUsername,
              newUsername: input.minecraftUsername,
            },
          });
          return { access: fresh.access, nameChanged };
        });
      } catch (error) {
        const cause = error as { code?: string; cause?: { code?: string } };
        if (cause.code === "23505" || cause.cause?.code === "23505")
          throw new AppError(
            409,
            "minecraft_identity_exists",
            "Цей Minecraft-нік уже прив’язаний до іншого Discord.",
          );
        throw error;
      }
      if (result.nameChanged) commandQueued(serverId);
      return {
        accessId: result.access.id,
        status: result.access.status,
        synchronization: "waiting" as const,
      };
    },
    async removeFromWhitelist(accessId: string, admin: WebAdmin) {
      const result = await db.transaction(async (tx) => {
        const found = await playerAccess.accessById(tx, accessId);
        if (!found) throw new AppError(404, "not_found", "Гравця не знайдено.");
        await lockUser(tx, found.user.id);
        const fresh = await playerAccess.accessById(tx, accessId);
        if (!fresh) throw new AppError(404, "not_found", "Гравця не знайдено.");
        if (fresh.access.status !== "active")
          throw new AppError(
            409,
            "access_not_active",
            "Гравець уже не має активного доступу.",
          );
        const access = await playerAccess.setAccessStatus(
          tx,
          accessId,
          "revoked",
        );
        await enqueueCommand(
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
  };
}
