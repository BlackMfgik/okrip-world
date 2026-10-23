import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, accessStatus } from "./common.js";
import { users } from "./users.js";
import { identities } from "./minecraft-identities.js";
export const playerAccess = pgTable(
  "player_access",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    minecraftIdentityId: uuid("minecraft_identity_id")
      .notNull()
      .references(() => identities.id),
    serverId: varchar("server_id").notNull().default("vanilla"),
    status: accessStatus("status").notNull(),
    banReason: text("ban_reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("player_access_user_id").on(t.userId),
    uniqueIndex("player_access_identity_server_unique").on(
      t.minecraftIdentityId,
      t.serverId,
    ),
  ],
);
