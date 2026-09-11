import { and, eq } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  applications,
  identities,
  playerAccess,
  commands,
} from "../../db/schema.js";
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
  rejectionReason?: string,
) =>
  db
    .update(applications)
    .set({
      status,
      reviewedByTelegramId: adminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      rejectionReason: status === "rejected" ? rejectionReason : null,
    })
    .where(and(eq(applications.id, id), eq(applications.status, "pending")))
    .returning();
export async function grant(db: Executor, userId: string, identityId: string) {
  return (
    await db
      .insert(playerAccess)
      .values({ userId, minecraftIdentityId: identityId, status: "active" })
      .returning()
  )[0]!;
}
export const addCommand = (
  db: Executor,
  accessId: string,
  serverId: string,
  username: string,
  type: "whitelist_add" | "whitelist_remove" | "kick" | "ban",
  reason?: string,
) =>
  db.insert(commands).values({
    playerAccessId: accessId,
    serverId,
    type,
    payload: { username, ...(reason ? { reason } : {}) },
  });
