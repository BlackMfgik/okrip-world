import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, ne, sql, lte, lt, or, notExists } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import { commands } from "../../db/schema.js";
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

export const enqueueCommand = (
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
