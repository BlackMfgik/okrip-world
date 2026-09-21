import { desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import { applications, identities, users } from "../../db/schema.js";
import type { AdminApplicationFilter } from "@okrip/contracts";

export function listApplications(
  db: Executor,
  filter: AdminApplicationFilter,
) {
  const query = db
    .select({
      application: applications,
      identity: identities,
      user: users,
    })
    .from(applications)
    .innerJoin(
      identities,
      eq(identities.id, applications.minecraftIdentityId),
    )
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
