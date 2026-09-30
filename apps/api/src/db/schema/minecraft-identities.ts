import {
  pgTable,
  uuid,
  varchar,
  boolean,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt } from "./common.js";
import { users } from "./users.js";
export const identities = pgTable(
  "minecraft_identities",
  {
    id: id(),
    // Ліміт акаунтів на користувача (1, для адмінів — 2) тримає тригер guard_identity_limit.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    username: varchar("username", { length: 16 }).notNull(),
    normalizedUsername: varchar("normalized_username", { length: 16 })
      .unique()
      .notNull(),
    verifiedOwnership: boolean("verified_ownership").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "valid_minecraft_name",
      sql`username ~ '^[A-Za-z0-9_]{3,16}$' AND normalized_username = lower(username)`,
    ),
    index("minecraft_identities_user_id").on(t.userId),
  ],
);
