import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/audit.repository.js";
import {
  lockUser,
  accessFor,
  enqueueMessage,
} from "../applications/application.repository.js";
import * as repo from "./moderation.repository.js";
export function moderationService(db: Database, env: Env) {
  return {
    async decide(
      publicId: string,
      action: "approve" | "reject",
      adminId: string,
      chatId: string,
    ) {
      if (
        !env.TELEGRAM_ADMIN_USER_IDS.split(",").includes(adminId) ||
        chatId !== env.TELEGRAM_ADMIN_CHAT_ID
      )
        throw new AppError(403, "forbidden", "Недостатньо прав.");
      return db.transaction(async (tx) => {
        const found = await repo.findApplication(tx, publicId);
        if (!found) throw new AppError(404, "not_found", "Заявку не знайдено.");
        await lockUser(tx, found.application.userId);
        const fresh = (await repo.findApplication(tx, publicId))!;
        if (fresh.application.status !== "pending")
          return fresh.application.status;
        if (await accessFor(tx, fresh.application.userId))
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
          adminId,
        );
        if (!changed.length)
          return (await repo.findApplication(tx, publicId))!.application.status;
        if (status === "approved") {
          const access = await repo.grant(
            tx,
            fresh.application.userId,
            fresh.identity.id,
          );
          await repo.addCommand(
            tx,
            access.id,
            env.MINECRAFT_SERVER_ID,
            fresh.identity.username,
            "whitelist_add",
          );
        }
        await audit(tx, {
          actorType: "telegram_admin",
          actorId: adminId,
          eventType: "application_" + status,
          entityType: "application",
          entityId: fresh.application.id,
        });
        await enqueueMessage(tx, fresh.application.id, "decided");
        return status;
      });
    },
  };
}
