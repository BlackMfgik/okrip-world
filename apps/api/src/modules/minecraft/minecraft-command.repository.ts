import { alias } from "drizzle-orm/pg-core";
import { and, eq, ne, sql, lte, lt, or, notExists } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  commands,
  playerAccess,
  identities,
  banEvents,
  applications,
} from "../../db/schema.js";
export const lockQueue = (db: Executor, serverId: string) =>
  db.execute(sql`select pg_advisory_xact_lock(hashtext(${serverId}))`);
export async function head(db: Executor, serverId: string) {
  const earlier = alias(commands, "earlier");
  return (
    await db
      .select()
      .from(commands)
      .where(
        and(
          eq(commands.serverId, serverId),
          ne(commands.status, "completed"),
          lte(commands.availableAt, new Date()),
          or(
            ne(commands.status, "leased"),
            lte(commands.leaseUntil, new Date()),
          ),
          notExists(
            db
              .select({ id: earlier.id })
              .from(earlier)
              .where(
                and(
                  eq(earlier.playerAccessId, commands.playerAccessId),
                  eq(earlier.serverId, serverId),
                  lt(earlier.sequence, commands.sequence),
                  ne(earlier.status, "completed"),
                ),
              ),
          ),
        ),
      )
      .orderBy(commands.sequence)
      .limit(1)
      .for("update")
  )[0];
}
export const lease = (db: Executor, id: string, leaseToken: string) =>
  db
    .update(commands)
    .set({
      status: "leased",
      leaseToken,
      leaseUntil: new Date(Date.now() + 60000),
      attempts: sql`attempts + 1`,
    })
    .where(eq(commands.id, id));
export async function find(db: Executor, id: string, serverId: string) {
  return (
    await db
      .select()
      .from(commands)
      .where(and(eq(commands.id, id), eq(commands.serverId, serverId)))
      .for("update")
  )[0];
}
export const complete = (db: Executor, id: string) =>
  db
    .update(commands)
    .set({
      status: "completed",
      completedAt: new Date(),
      leaseUntil: null,
      lastError: null,
    })
    .where(eq(commands.id, id));
export const fail = (
  db: Executor,
  id: string,
  error: string,
  attempts: number,
) => {
  const retryAt = new Date(
    Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8)),
  );
  return db
    .update(commands)
    .set({
      status: "failed",
      leaseUntil: null,
      lastError: error,
      availableAt: retryAt,
    })
    .where(eq(commands.id, id))
    .then(() => retryAt);
};
export async function commandAccess(db: Executor, id: string) {
  return (
    await db.select().from(playerAccess).where(eq(playerAccess.id, id))
  )[0]!;
}
export async function identityByName(db: Executor, username: string) {
  return (
    await db
      .select()
      .from(identities)
      .where(eq(identities.normalizedUsername, username.toLowerCase()))
  )[0];
}
export const recordBanEvent = (
  db: Executor,
  eventId: string,
  serverId: string,
) =>
  db
    .insert(banEvents)
    .values({ eventId, serverId })
    .onConflictDoNothing()
    .returning();
export async function banAccess(
  db: Executor,
  userId: string,
  identityId: string,
  reason: string,
) {
  return (
    await db
      .insert(playerAccess)
      .values({
        userId,
        minecraftIdentityId: identityId,
        status: "banned",
        banReason: reason,
        bannedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: playerAccess.userId,
        set: {
          status: "banned",
          banReason: reason,
          bannedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()
  )[0]!;
}
export const cancelPending = (db: Executor, userId: string) =>
  db
    .update(applications)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(applications.userId, userId), eq(applications.status, "pending")),
    )
    .returning();
