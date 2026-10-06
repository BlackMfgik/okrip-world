import { randomUUID } from "node:crypto";
import { commandSchema } from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import { lockUser } from "../player-access/index.js";
import * as playerAccess from "../player-access/index.js";
import { enqueueMessage, cancelPending } from "../applications/index.js";
import { enqueueCommand } from "../command-queue/index.js";
import * as queue from "../command-queue/index.js";
import * as repo from "./minecraft-command.repository.js";
export function minecraftService(
  db: Database,
  serverId: string,
  commandQueued: (serverId: string) => void = () => undefined,
) {
  return {
    async whitelistSnapshot() {
      const players = await playerAccess.activePlayers(db);
      return {
        // usernames — для звірки вайтліста (старі версії плагіна читають лише його);
        // players — деталі для внутрішньоігрового меню /wlmenu.
        usernames: players.map((row) => row.username),
        players: players.map((row) => ({
          ...row,
          addedAt: row.addedAt.toISOString(),
        })),
      };
    },
    async lease() {
      return db.transaction(async (tx) => {
        await queue.lockQueue(tx, serverId);
        // Preserve order per player while letting unrelated players make progress.
        const command = await queue.head(tx, serverId);
        if (!command) return { commands: [] };
        if (
          command.status === "leased" &&
          command.leaseUntil &&
          command.leaseUntil > new Date()
        )
          return { commands: [] };
        if (command.availableAt > new Date()) return { commands: [] };
        const access = await playerAccess.commandAccess(
          tx,
          command.playerAccessId,
        );
        if (command.type === "whitelist_add" && access.status !== "active") {
          await queue.complete(tx, command.id);
          return { commands: [] };
        }
        const leaseToken = randomUUID();
        await queue.lease(tx, command.id, leaseToken);
        return { commands: [commandSchema.parse({ ...command, leaseToken })] };
      });
    },
    async acknowledge(id: string, leaseToken: string, error?: string) {
      const retryAt = await db.transaction(async (tx) => {
        const command = await queue.find(tx, id, serverId);
        if (!command)
          throw new AppError(404, "not_found", "Команду не знайдено.");
        if (command.leaseToken !== leaseToken)
          throw new AppError(
            409,
            "stale_lease",
            "Оренда команди вже неактуальна.",
          );
        if (command.status === "completed") return;
        if (
          command.status !== "leased" ||
          !command.leaseUntil ||
          command.leaseUntil <= new Date()
        )
          throw new AppError(409, "stale_lease", "Оренда команди завершилась.");
        const retryAt = error
          ? await queue.fail(tx, id, error, command.attempts)
          : undefined;
        if (!error) await queue.complete(tx, id);
        await audit(tx, {
          actorType: "minecraft_server",
          actorId: serverId,
          eventType: error ? "command_failed" : "command_completed",
          entityType: "command",
          entityId: id,
          metadata: error ? { error } : {},
        });
        return retryAt;
      });
      if (retryAt) {
        const timer = setTimeout(
          () => commandQueued(serverId),
          Math.max(0, retryAt.getTime() - Date.now()),
        );
        timer.unref();
      }
    },
    async ban(event: { eventId: string; username: string; reason: string }) {
      const queued = await db.transaction(async (tx) => {
        const identity = await playerAccess.identityByName(tx, event.username);
        if (!identity)
          throw new AppError(
            404,
            "identity_not_found",
            "Нік не зареєстрований.",
          );
        await lockUser(tx, identity.userId);
        if (!(await repo.recordBanEvent(tx, event.eventId, serverId)).length)
          return false;
        const access = await playerAccess.banAccess(
          tx,
          identity.userId,
          identity.id,
          event.reason,
        );
        for (const app of await cancelPending(tx, identity.userId))
          await enqueueMessage(tx, app.id, "decided");
        await enqueueCommand(
          tx,
          access.id,
          serverId,
          identity.username,
          "whitelist_remove",
        );
        await enqueueCommand(
          tx,
          access.id,
          serverId,
          identity.username,
          "ban",
          event.reason,
        );
        await audit(tx, {
          actorType: "minecraft_server",
          actorId: serverId,
          eventType: "player_banned",
          entityType: "player_access",
          entityId: access.id,
        });
        return true;
      });
      if (queued) commandQueued(serverId);
    },
    /**
     * /wlunban у грі. Бан знімається переходом banned → revoked; з restoreWhitelist
     * доступ одразу стає active і сервер отримує whitelist_add (як «Додати гравця»).
     * Локальний бан на сервері плагін знімає сам до виклику цього методу.
     */
    async unban(event: {
      username: string;
      restoreWhitelist: boolean;
      actor?: string;
    }) {
      const result = await db.transaction(async (tx) => {
        const identity = await playerAccess.identityByName(tx, event.username);
        if (!identity) return { status: "not_registered" as const };
        await lockUser(tx, identity.userId);
        const access = await playerAccess.accessForIdentity(tx, identity.id);
        if (!access || access.status !== "banned")
          return {
            status: "not_banned" as const,
            username: identity.username,
            access: access?.status ?? null,
          };
        await playerAccess.unbanAccess(tx, access.id);
        if (event.restoreWhitelist) {
          await playerAccess.restoreAccess(tx, access.id);
          await enqueueCommand(
            tx,
            access.id,
            serverId,
            identity.username,
            "whitelist_add",
          );
        }
        await audit(tx, {
          actorType: "minecraft_server",
          actorId: serverId,
          eventType: "player_unbanned",
          entityType: "player_access",
          entityId: access.id,
          metadata: {
            source: "minecraft_command",
            actor: event.actor ?? null,
            restoreWhitelist: event.restoreWhitelist,
            previousReason: access.banReason,
          },
        });
        return {
          status: "unbanned" as const,
          username: identity.username,
          access: event.restoreWhitelist
            ? ("active" as const)
            : ("revoked" as const),
        };
      });
      if (result.status === "unbanned" && event.restoreWhitelist)
        commandQueued(serverId);
      return result;
    },
    /** /wldel у грі: те саме, що «Видалити» в адмін-панелі сайту. */
    async removeFromWhitelist(event: { username: string; actor?: string }) {
      const result = await db.transaction(async (tx) => {
        const identity = await playerAccess.identityByName(tx, event.username);
        if (!identity) return { status: "not_registered" as const };
        await lockUser(tx, identity.userId);
        const access = await playerAccess.accessForIdentity(tx, identity.id);
        if (!access || access.status !== "active")
          return {
            status: "not_active" as const,
            username: identity.username,
          };
        await playerAccess.revokeAccess(tx, access.id);
        await enqueueCommand(
          tx,
          access.id,
          serverId,
          identity.username,
          "whitelist_remove",
        );
        await audit(tx, {
          actorType: "minecraft_server",
          actorId: serverId,
          eventType: "whitelist_player_removed",
          entityType: "player_access",
          entityId: access.id,
          metadata: { source: "minecraft_command", actor: event.actor ?? null },
        });
        return { status: "removed" as const, username: identity.username };
      });
      if (result.status === "removed") commandQueued(serverId);
      return result;
    },
  };
}
