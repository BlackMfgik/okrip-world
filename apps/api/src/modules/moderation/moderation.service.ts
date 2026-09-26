import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import { sql } from "drizzle-orm";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/audit.repository.js";
import {
  lockUser,
  accessFor,
  enqueueMessage,
} from "../applications/application.repository.js";
import * as repo from "./moderation.repository.js";

interface Reviewer {
  actorType: "telegram_admin" | "user";
  actorId: string;
  externalId: string;
  name: string;
  source: "telegram" | "web_admin";
}

export function moderationService(
  db: Database,
  env: Env,
  commandQueued: (serverId: string) => void = () => undefined,
) {
  const moderatorIds = new Set(
    [env.TELEGRAM_ADMIN_USER_IDS, env.TELEGRAM_EXTRA_ADMIN_USER_IDS]
      .flatMap((ids) => ids.split(","))
      .filter(Boolean),
  );
  const assertModerator = (adminId: string, chatId: string) => {
    if (
      !env.TELEGRAM_ADMIN_CHAT_ID ||
      !moderatorIds.has(adminId) ||
      chatId !== env.TELEGRAM_ADMIN_CHAT_ID
    )
      throw new AppError(403, "forbidden", "Недостатньо прав.");
  };

  async function applyDecision(
    publicId: string,
    action: "approve" | "reject",
    reviewer: Reviewer,
    rejectionReason?: string,
  ) {
    const reason = rejectionReason?.trim();
    if (action === "reject" && (!reason || reason.length > 256))
      throw new AppError(
        400,
        "invalid_rejection_reason",
        "Причина відмови має містити від 1 до 256 символів.",
      );
    let queued = false;
    const result = await db.transaction(async (tx) => {
      if (env.APPLICATION_REPEAT_DEBUG)
        await tx.execute(
          sql`select set_config('okrip.allow_repeat_applications', 'on', true)`,
        );
      const found = await repo.findApplication(tx, publicId);
      if (!found) throw new AppError(404, "not_found", "Заявку не знайдено.");
      await lockUser(tx, found.application.userId);
      const fresh = (await repo.findApplication(tx, publicId))!;
      if (fresh.application.status !== "pending")
        return fresh.application.status;
      const existingAccess = await accessFor(tx, fresh.application.userId);
      const revoked = existingAccess?.status === "revoked";
      if (existingAccess && !revoked && !env.APPLICATION_REPEAT_DEBUG)
        throw new AppError(
          409,
          "access_exists",
          "Потрібне окреме рішення щодо доступу.",
        );
      const status = action === "approve" ? "approved" : "rejected";
      const changed = await repo.decide(
        tx,
        fresh.application.id,
        status,
        reviewer.externalId,
        reviewer.name,
        reason,
      );
      if (!changed.length)
        return (await repo.findApplication(tx, publicId))!.application.status;
      if (
        status === "approved" &&
        (!existingAccess || revoked || env.APPLICATION_REPEAT_DEBUG)
      ) {
        const access = !existingAccess
          ? await repo.grant(tx, fresh.application.userId, fresh.identity.id)
          : revoked
            ? await repo.reactivate(tx, existingAccess.id)
            : existingAccess;
        await repo.addCommand(
          tx,
          access.id,
          env.MINECRAFT_SERVER_ID,
          fresh.identity.username,
          "whitelist_add",
        );
        queued = true;
      }
      await audit(tx, {
        actorType: reviewer.actorType,
        actorId: reviewer.actorId,
        eventType: "application_" + status,
        entityType: "application",
        entityId: fresh.application.id,
        metadata: {
          source: reviewer.source,
          reviewerId: reviewer.externalId,
        },
      });
      await enqueueMessage(tx, fresh.application.id, "decided");
      return status;
    });
    if (queued) commandQueued(env.MINECRAFT_SERVER_ID);
    return result;
  }

  return {
    async prepareRejection(publicId: string, adminId: string, chatId: string) {
      assertModerator(adminId, chatId);
      const found = await repo.findApplication(db, publicId);
      if (!found) throw new AppError(404, "not_found", "Заявку не знайдено.");
      return {
        number: found.application.number,
        status: found.application.status,
      };
    },
    async decide(
      publicId: string,
      action: "approve" | "reject",
      adminId: string,
      chatId: string,
      rejectionReason?: string,
      adminName?: string,
    ) {
      assertModerator(adminId, chatId);
      return applyDecision(
        publicId,
        action,
        {
          actorType: "telegram_admin",
          actorId: adminId,
          externalId: adminId,
          name: adminName?.trim() || adminId,
          source: "telegram",
        },
        rejectionReason,
      );
    },
    async decideAsWebAdmin(
      publicId: string,
      action: "approve" | "reject",
      admin: {
        id: string;
        discordId: string;
        discordUsername: string;
        discordGlobalName: string | null;
      },
      rejectionReason?: string,
    ) {
      return applyDecision(
        publicId,
        action,
        {
          actorType: "user",
          actorId: admin.id,
          externalId: admin.discordId,
          name: admin.discordGlobalName ?? admin.discordUsername,
          source: "web_admin",
        },
        rejectionReason,
      );
    },
  };
}
