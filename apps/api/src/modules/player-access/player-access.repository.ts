import { desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import { users, identities, playerAccess } from "../../db/schema.js";
export const lockUser = (db: Executor, userId: string) =>
  db.select().from(users).where(eq(users.id, userId)).for("update");

export async function accessFor(db: Executor, userId: string) {
  return (
    await db
      .select()
      .from(playerAccess)
      .where(eq(playerAccess.userId, userId))
      .orderBy(sql`${playerAccess.status} = 'revoked'`, playerAccess.createdAt)
      .limit(1)
  )[0];
}

export async function accessForIdentity(db: Executor, identityId: string) {
  return (
    await db
      .select()
      .from(playerAccess)
      .where(eq(playerAccess.minecraftIdentityId, identityId))
  )[0];
}

export async function identityFor(db: Executor, userId: string) {
  return (
    await db
      .select()
      .from(identities)
      .where(eq(identities.userId, userId))
      .orderBy(identities.createdAt)
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

export async function grant(db: Executor, userId: string, identityId: string) {
  return (
    await db
      .insert(playerAccess)
      .values({ userId, minecraftIdentityId: identityId, status: "active" })
      .returning()
  )[0]!;
}

export async function reactivate(db: Executor, accessId: string) {
  await db.execute(
    sql`select set_config('okrip.allow_access_restoration', 'on', true)`,
  );
  return (
    await db
      .update(playerAccess)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(playerAccess.id, accessId))
      .returning()
  )[0]!;
}

export function listWhitelistPlayers(db: Executor) {
  return db
    .select({ access: playerAccess, identity: identities, user: users })
    .from(playerAccess)
    .innerJoin(identities, eq(identities.id, playerAccess.minecraftIdentityId))
    .innerJoin(users, eq(users.id, playerAccess.userId))
    .where(eq(playerAccess.status, "active"))
    .orderBy(desc(playerAccess.createdAt));
}

export async function userByDiscordId(db: Executor, discordId: string) {
  return (
    await db.select().from(users).where(eq(users.discordId, discordId)).limit(1)
  )[0];
}

export async function createUser(
  db: Executor,
  discordId: string,
  discordUsername: string,
) {
  return (
    await db.insert(users).values({ discordId, discordUsername }).returning()
  )[0]!;
}

export function identitiesByUserId(db: Executor, userId: string) {
  return db.select().from(identities).where(eq(identities.userId, userId));
}

export async function identityByName(db: Executor, username: string) {
  return (
    await db
      .select()
      .from(identities)
      .where(eq(identities.normalizedUsername, username.toLowerCase()))
  )[0];
}

export function accessesByUserId(db: Executor, userId: string) {
  return db.select().from(playerAccess).where(eq(playerAccess.userId, userId));
}

export async function accessById(db: Executor, accessId: string) {
  return (
    await db
      .select({ access: playerAccess, identity: identities, user: users })
      .from(playerAccess)
      .innerJoin(
        identities,
        eq(identities.id, playerAccess.minecraftIdentityId),
      )
      .innerJoin(users, eq(users.id, playerAccess.userId))
      .where(eq(playerAccess.id, accessId))
      .limit(1)
  )[0];
}

export async function setAccessStatus(
  db: Executor,
  accessId: string,
  status: "active" | "revoked",
) {
  return (
    await db
      .update(playerAccess)
      .set({ status, updatedAt: new Date() })
      .where(eq(playerAccess.id, accessId))
      .returning()
  )[0]!;
}

export async function renameIdentity(
  db: Executor,
  identityId: string,
  username: string,
) {
  await db.execute(
    sql`select set_config('okrip.allow_nickname_change', 'on', true)`,
  );
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

export async function commandAccess(db: Executor, id: string) {
  return (
    await db.select().from(playerAccess).where(eq(playerAccess.id, id))
  )[0]!;
}

export async function activePlayers(db: Executor) {
  return db
    .select({
      username: identities.username,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordDisplayName: users.discordGlobalName,
      addedAt: playerAccess.createdAt,
    })
    .from(playerAccess)
    .innerJoin(identities, eq(identities.id, playerAccess.minecraftIdentityId))
    .innerJoin(users, eq(users.id, playerAccess.userId))
    .where(eq(playerAccess.status, "active"))
    .orderBy(desc(playerAccess.createdAt));
}

export const revokeAccess = (db: Executor, accessId: string) =>
  db
    .update(playerAccess)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(playerAccess.id, accessId));

export const unbanAccess = (db: Executor, accessId: string) =>
  db
    .update(playerAccess)
    .set({
      status: "revoked",
      banReason: null,
      bannedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(playerAccess.id, accessId));

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
        target: playerAccess.minecraftIdentityId,
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
