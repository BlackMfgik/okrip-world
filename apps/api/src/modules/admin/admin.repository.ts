import { desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  applications,
  identities,
  playerAccess,
  users,
} from "../../db/schema.js";
import type { AdminApplicationFilter } from "@okrip/contracts";

export function listApplications(db: Executor, filter: AdminApplicationFilter) {
  const query = db
    .select({
      application: applications,
      identity: identities,
      user: users,
    })
    .from(applications)
    .innerJoin(identities, eq(identities.id, applications.minecraftIdentityId))
    .innerJoin(users, eq(users.id, applications.userId))
    .orderBy(desc(applications.createdAt))
    .limit(200);

  return filter === "all"
    ? query
    : query.where(eq(applications.status, filter));
}

export function applicationCounts(db: Executor) {
  return db
    .select({
      status: applications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .groupBy(applications.status);
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

export async function identityByUserId(db: Executor, userId: string) {
  return (
    await db.select().from(identities).where(eq(identities.userId, userId))
  )[0];
}

export async function identityByName(db: Executor, username: string) {
  return (
    await db
      .select()
      .from(identities)
      .where(eq(identities.normalizedUsername, username.toLowerCase()))
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
      .values({
        userId,
        username,
        normalizedUsername: username.toLowerCase(),
      })
      .returning()
  )[0]!;
}

export async function accessByUserId(db: Executor, userId: string) {
  return (
    await db.select().from(playerAccess).where(eq(playerAccess.userId, userId))
  )[0];
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

export async function createAccess(
  db: Executor,
  userId: string,
  identityId: string,
) {
  return (
    await db
      .insert(playerAccess)
      .values({ userId, minecraftIdentityId: identityId, status: "active" })
      .returning()
  )[0]!;
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

export const allowAccessRestoration = (db: Executor) =>
  db.execute(
    sql`select set_config('okrip.allow_access_restoration', 'on', true)`,
  );
