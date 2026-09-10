import { randomBytes } from "node:crypto";
import {
  submitApplicationSchema,
  currentApplicationSchema,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import type { DiscordProvider } from "../auth/discord.service.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/audit.repository.js";
import * as repo from "./application.repository.js";
export function applicationService(db: Database, discord: DiscordProvider) {
  return {
    async submit(user: { id: string; discordId: string }, input: unknown) {
      const { minecraftUsername } = submitApplicationSchema.parse(input);
      await discord.membership(user.discordId);
      try {
        await db.transaction(async (tx) => {
          await repo.lockUser(tx, user.id);
          if (await repo.accessFor(tx, user.id))
            throw new AppError(
              409,
              "access_exists",
              "Доступ уже розглянуто. Зверніться до адміністрації.",
            );
          const current = await repo.latest(tx, user.id);
          if (
            current?.application.status === "pending" ||
            current?.application.status === "approved"
          )
            throw new AppError(
              409,
              "application_exists",
              "У вас уже є активна заявка.",
            );
          const existing = await repo.identityFor(tx, user.id);
          if (
            existing &&
            existing.normalizedUsername !== minecraftUsername.toLowerCase()
          )
            throw new AppError(
              409,
              "identity_locked",
              "Для зміни ніка зверніться до адміністрації.",
            );
          const identity =
            existing ??
            (await repo.createIdentity(tx, user.id, minecraftUsername));
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
      return this.current(user.id);
    },
    async current(userId: string) {
      const [current, access] = await Promise.all([
        repo.latest(db, userId),
        repo.accessFor(db, userId),
      ]);
      const command = access ? await repo.lastAdd(db, access.id) : undefined;
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
      });
    },
  };
}
