import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  submitApplicationSchema,
  currentApplicationSchema,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import {
  DISCORD_MEMBERSHIP_CHECK_ENABLED,
  type DiscordProvider,
} from "../auth/discord.service.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/audit.repository.js";
import {
  addCommand,
  decide,
  grant,
  reactivate,
} from "../moderation/moderation.repository.js";
import * as repo from "./application.repository.js";

export const APPLICATION_SUBMISSION_COOLDOWN_MS = 60_000;

export function applicationService(
  db: Database,
  discord: DiscordProvider,
  repeatSubmissionEnabled = false,
  autoApproveEnabled = false,
  minecraftServerId = "",
  commandQueued: (serverId: string) => void = () => undefined,
) {
  return {
    async submit(user: { id: string; discordId: string }, input: unknown) {
      const { minecraftUsername } = submitApplicationSchema.parse(input);
      if (DISCORD_MEMBERSHIP_CHECK_ENABLED) {
        await discord.membership(user.discordId);
      }
      let queued = false;
      try {
        await db.transaction(async (tx) => {
          if (repeatSubmissionEnabled)
            await tx.execute(
              sql`select set_config('okrip.allow_repeat_applications', 'on', true)`,
            );
          const [lockedUser] = await repo.lockUser(tx, user.id);
          if (lockedUser?.applicationBlockedAt) {
            if (
              !lockedUser.applicationBlockedUntil ||
              lockedUser.applicationBlockedUntil.getTime() > Date.now()
            )
              throw new AppError(
                403,
                "application_blocked",
                lockedUser.applicationBlockedUntil
                  ? "Надсилання заявок тимчасово заблоковано на одну годину."
                  : "Адміністратор заборонив вам надсилати заявки.",
              );
            await repo.clearApplicationBlock(tx, user.id);
          }
          const existingAccess = await repo.accessFor(tx, user.id);
          // Після відкликання доступу гравець може подати заявку повторно.
          const revoked = existingAccess?.status === "revoked";
          if (!repeatSubmissionEnabled && existingAccess && !revoked)
            throw new AppError(
              409,
              "access_exists",
              "Доступ уже розглянуто. Зверніться до адміністрації.",
            );
          if (repeatSubmissionEnabled) {
            const cancelled = await repo.cancelPending(tx, user.id);
            for (const application of cancelled)
              await repo.enqueueMessage(tx, application.id, "decided");
          } else {
            const current = await repo.latest(tx, user.id);
            if (
              current?.application.status === "pending" ||
              (current?.application.status === "approved" && !revoked)
            )
              throw new AppError(
                409,
                "application_exists",
                "У вас уже є активна заявка.",
              );
            if (
              current &&
              current.application.createdAt.getTime() +
                APPLICATION_SUBMISSION_COOLDOWN_MS >
                Date.now()
            )
              throw new AppError(
                429,
                "application_cooldown",
                "Наступну заявку можна буде подати після завершення таймера.",
              );
          }
          const existing = await repo.identityFor(tx, user.id);
          if (
            existing &&
            existing.normalizedUsername !== minecraftUsername.toLowerCase() &&
            !repeatSubmissionEnabled
          )
            throw new AppError(
              409,
              "identity_locked",
              "Для зміни ніка зверніться до адміністрації.",
            );
          const identity = existing
            ? existing.normalizedUsername === minecraftUsername.toLowerCase()
              ? existing
              : await repo.updateIdentityForDebug(
                  tx,
                  existing.id,
                  minecraftUsername,
                )
            : await repo.createIdentity(tx, user.id, minecraftUsername);
          const app = await repo.createApplication(
            tx,
            user.id,
            identity.id,
            randomBytes(12).toString("base64url"),
          );
          await repo.enqueueMessage(tx, app.id, "created");
          await audit(tx, {
            actorType: "user",
            actorId: user.id,
            eventType: "application_submitted",
            entityType: "application",
            entityId: app.id,
          });
          if (autoApproveEnabled) {
            if (!minecraftServerId)
              throw new Error(
                "APPLICATION_AUTO_APPROVE requires MINECRAFT_SERVER_ID",
              );
            const approved = await decide(
              tx,
              app.id,
              "approved",
              "system",
              "Автоматично",
            );
            if (!approved.length)
              throw new Error(
                "Automatic approval lost its pending application",
              );
            const access = !existingAccess
              ? await grant(tx, user.id, identity.id)
              : revoked
                ? await reactivate(tx, existingAccess.id)
                : existingAccess;
            await addCommand(
              tx,
              access.id,
              minecraftServerId,
              identity.username,
              "whitelist_add",
            );
            await repo.enqueueMessage(tx, app.id, "decided");
            await audit(tx, {
              actorType: "system",
              actorId: "automatic_approval",
              eventType: "application_approved",
              entityType: "application",
              entityId: app.id,
            });
            queued = true;
          }
        });
      } catch (error) {
        const cause = error as { code?: string; cause?: { code?: string } };
        if (cause.code === "23505" || cause.cause?.code === "23505")
          throw new AppError(
            409,
            "duplicate_identity",
            "Цей нік або заявка вже зареєстровані.",
          );
        throw error;
      }
      if (queued) commandQueued(minecraftServerId);
      return this.current(user.id);
    },
    async current(userId: string) {
      const [current, access] = await Promise.all([
        repo.latest(db, userId),
        repo.accessFor(db, userId),
      ]);
      const command = access ? await repo.lastAdd(db, access.id) : undefined;
      const nextSubmission =
        current && !repeatSubmissionEnabled
          ? new Date(
              current.application.createdAt.getTime() +
                APPLICATION_SUBMISSION_COOLDOWN_MS,
            )
          : null;
      return currentApplicationSchema.parse({
        application: current
          ? {
              publicId: current.application.publicId,
              minecraftUsername: current.username,
              status: current.application.status,
              rejectionReason: current.application.rejectionReason,
            }
          : null,
        access: access?.status ?? null,
        synchronization:
          access?.status === "active"
            ? command?.status === "completed"
              ? "completed"
              : "waiting"
            : null,
        nextSubmissionAt:
          nextSubmission && nextSubmission.getTime() > Date.now()
            ? nextSubmission.toISOString()
            : null,
        repeatSubmissionEnabled,
      });
    },
  };
}
