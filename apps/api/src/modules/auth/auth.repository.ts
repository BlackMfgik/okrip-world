import { and, eq, gt } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import { adminAccounts, oauthStates, sessions, users } from "../../db/schema.js";
import type { DiscordIdentity } from "./discord.service.js";
export const saveState = (
  db: Executor,
  tokenHash: string,
  browserHash: string,
) =>
  db.insert(oauthStates).values({
    tokenHash,
    browserHash,
    expiresAt: new Date(Date.now() + 600000),
  });
export const consumeState = (
  db: Executor,
  tokenHash: string,
  browserHash: string,
) =>
  db
    .delete(oauthStates)
    .where(
      and(
        eq(oauthStates.tokenHash, tokenHash),
        eq(oauthStates.browserHash, browserHash),
        gt(oauthStates.expiresAt, new Date()),
      ),
    )
    .returning();
export async function upsertUser(db: Executor, profile: DiscordIdentity) {
  const values = {
    discordId: profile.id,
    discordUsername: profile.username,
    discordGlobalName: profile.global_name,
    discordAvatar: profile.avatar,
  };
  return (
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.discordId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning()
  )[0]!;
}
export const saveSession = (db: Executor, userId: string, tokenHash: string) =>
  db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
export async function findSession(db: Executor, tokenHash: string) {
  return (
    await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
  )[0]?.user;
}
export const deleteSession = (db: Executor, tokenHash: string) =>
  db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));

export async function isAdmin(db: Executor, discordId: string) {
  return Boolean(
    (
      await db
        .select({ discordId: adminAccounts.discordId })
        .from(adminAccounts)
        .where(eq(adminAccounts.discordId, discordId))
        .limit(1)
    )[0],
  );
}
