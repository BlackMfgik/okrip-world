import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id } from "./common.js";
import { applications } from "./applications.js";
export const telegramJobs = pgTable(
  "telegram_jobs",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    kind: varchar("kind").notNull(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("telegram_job_unique").on(t.applicationId, t.kind)],
);
