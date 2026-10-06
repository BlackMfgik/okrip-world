import { and, desc, eq } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  users,
  identities,
  applications,
  telegramJobs,
} from "../../db/schema.js";
export const clearApplicationBlock = (db: Executor, userId: string) =>
  db
    .update(users)
    .set({
      applicationBlockedAt: null,
      applicationBlockedUntil: null,
      applicationBlockedByDiscordId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

export async function latest(db: Executor, userId: string) {
  return (
    await db
      .select({ application: applications, username: identities.username })
      .from(applications)
      .innerJoin(
        identities,
        eq(identities.id, applications.minecraftIdentityId),
      )
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt))
      .limit(1)
  )[0];
}

export async function createApplication(
  db: Executor,
  userId: string,
  identityId: string,
  publicId: string,
) {
  return (
    await db
      .insert(applications)
      .values({ userId, minecraftIdentityId: identityId, publicId })
      .returning()
  )[0]!;
}

export async function cancelPending(db: Executor, userId: string) {
  return db
    .update(applications)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(applications.userId, userId), eq(applications.status, "pending")),
    )
    .returning({ id: applications.id });
}

export const enqueueMessage = (
  db: Executor,
  applicationId: string,
  kind: string,
) =>
  db.insert(telegramJobs).values({ applicationId, kind }).onConflictDoNothing();

export async function findApplication(db: Executor, publicId: string) {
  return (
    await db
      .select({ application: applications, identity: identities })
      .from(applications)
      .innerJoin(
        identities,
        eq(identities.id, applications.minecraftIdentityId),
      )
      .where(eq(applications.publicId, publicId))
  )[0];
}

export const decide = (
  db: Executor,
  id: string,
  status: "approved" | "rejected",
  adminId: string,
  adminName: string,
  rejectionReason?: string,
) =>
  db
    .update(applications)
    .set({
      status,
      reviewedByTelegramId: adminId,
      reviewedByTelegramName: adminName,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      rejectionReason: status === "rejected" ? rejectionReason : null,
    })
    .where(and(eq(applications.id, id), eq(applications.status, "pending")))
    .returning();
