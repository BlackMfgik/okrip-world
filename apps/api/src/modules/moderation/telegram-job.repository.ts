import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.js";
import {
  telegramJobs,
  applications,
  identities,
  users,
} from "../../db/schema.js";
export async function takeJob(db: Executor) {
  const job = (
    await db
      .select()
      .from(telegramJobs)
      .where(
        and(
          isNull(telegramJobs.completedAt),
          lte(telegramJobs.availableAt, new Date()),
        ),
      )
      .orderBy(telegramJobs.availableAt)
      .limit(1)
      .for("update", { skipLocked: true })
  )[0];
  if (job)
    await db
      .update(telegramJobs)
      .set({
        attempts: sql`attempts + 1`,
        availableAt: new Date(
          Date.now() + Math.min(300000, 10000 * 2 ** Math.min(job.attempts, 5)),
        ),
      })
      .where(eq(telegramJobs.id, job.id));
  return job;
}
export async function messageData(db: Executor, applicationId: string) {
  return (
    await db
      .select({ app: applications, identity: identities, user: users })
      .from(applications)
      .innerJoin(
        identities,
        eq(identities.id, applications.minecraftIdentityId),
      )
      .innerJoin(users, eq(users.id, applications.userId))
      .where(eq(applications.id, applicationId))
  )[0]!;
}
export const recordMessage = (
  db: Executor,
  id: string,
  chatId: string,
  messageId: number,
) =>
  db
    .update(applications)
    .set({ telegramChatId: chatId, telegramMessageId: messageId })
    .where(eq(applications.id, id));
export const finishJob = (db: Executor, id: string) =>
  db
    .update(telegramJobs)
    .set({ completedAt: new Date() })
    .where(eq(telegramJobs.id, id));
