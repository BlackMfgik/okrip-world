import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { id, createdAt } from "./common.js";
import { users } from "./users.js";
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("session_expiry").on(t.expiresAt)],
);
