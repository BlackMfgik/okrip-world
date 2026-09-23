import { and, desc, eq } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  users,
  identities,
  applications,
  playerAccess,
  commands,
  telegramJobs,
} from "../../db/schema.js";
export const lockUser = (db: Executor, userId: string) =>
  db.select().from(users).where(eq(users.id, userId)).for("update");
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
export async function accessFor(db: Executor, userId: string) {
  return (
    await db.select().from(playerAccess).where(eq(playerAccess.userId, userId))
  )[0];
}
export async function identityFor(db: Executor, userId: string) {
  return (
    await db.select().from(identities).where(eq(identities.userId, userId))
  )[0];
}
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
export async function createIdentity(
  db: Executor,
  userId: string,
  username: string,
) {
  return (
    await db
      .insert(identities)
      .values({ userId, username, normalizedUsername: username.toLowerCase() })
      .returning()
  )[0]!;
}
export async function updateIdentityForDebug(
  db: Executor,
  identityId: string,
  username: string,
) {
  return (
    await db
      .update(identities)
      .set({
        username,
        normalizedUsername: username.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(identities.id, identityId))
      .returning()
  )[0]!;
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
export async function lastAdd(db: Executor, accessId: string) {
  return (
    await db
      .select()
      .from(commands)
      .where(
        and(
          eq(commands.playerAccessId, accessId),
          eq(commands.type, "whitelist_add"),
        ),
      )
      .orderBy(desc(commands.createdAt))
      .limit(1)
  )[0];
}
