import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, accessStatus } from "./common.js";
import { users } from "./users.js";
import { identities } from "./minecraft-identities.js";
export const playerAccess = pgTable("player_access", {
  id: id(),
  userId: uuid("user_id")
    .unique()
    .notNull()
    .references(() => users.id),
  minecraftIdentityId: uuid("minecraft_identity_id")
    .unique()
    .notNull()
    .references(() => identities.id),
  status: accessStatus("status").notNull(),
  banReason: text("ban_reason"),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
