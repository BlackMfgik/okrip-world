import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const oauthStates = pgTable(
  "oauth_states",
  {
    tokenHash: varchar("token_hash").primaryKey(),
    browserHash: varchar("browser_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("oauth_expiry").on(t.expiresAt)],
);
