import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  applications,
  adminAccounts,
  identities,
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

  if (filter === "all") return query;
  if (filter === "blocked") return query.where(activeApplicationBlock());
  return query.where(eq(applications.status, filter));
}

/** Заборона подавати заявки діє: безстрокова або ще не минула. */
function activeApplicationBlock() {
  return and(
    isNotNull(users.applicationBlockedAt),
    or(
      isNull(users.applicationBlockedUntil),
      gt(users.applicationBlockedUntil, new Date()),
    ),
  );
}

export async function blockedUserCount(db: Executor) {
  return (
    await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(activeApplicationBlock())
  )[0]!.count;
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

export async function applicationUserByPublicId(
  db: Executor,
  publicId: string,
) {
  return (
    await db
      .select({ application: applications, user: users })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.userId))
      .where(eq(applications.publicId, publicId))
      .limit(1)
  )[0];
}

export async function setApplicationBlocked(
  db: Executor,
  userId: string,
  blockedByDiscordId: string | null,
  blockedUntil: Date | null,
) {
  return (
    await db
      .update(users)
      .set({
        applicationBlockedAt: blockedByDiscordId ? new Date() : null,
        applicationBlockedUntil: blockedUntil,
        applicationBlockedByDiscordId: blockedByDiscordId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()
  )[0]!;
}

export function listAdminAccounts(db: Executor) {
  return db
    .select({ account: adminAccounts, user: users })
    .from(adminAccounts)
    .leftJoin(users, eq(users.discordId, adminAccounts.discordId))
    .orderBy(desc(adminAccounts.canManageAdmins), asc(adminAccounts.createdAt));
}

export async function adminAccountByDiscordId(db: Executor, discordId: string) {
  return (
    await db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.discordId, discordId))
      .limit(1)
  )[0];
}

export async function createAdminAccount(db: Executor, discordId: string) {
  return (await db.insert(adminAccounts).values({ discordId }).returning())[0]!;
}

export async function deleteAdminAccount(db: Executor, discordId: string) {
  return (
    await db
      .delete(adminAccounts)
      .where(eq(adminAccounts.discordId, discordId))
      .returning()
  )[0];
}
