import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./common.js";

export const users = pgTable("users", {
  id: id(),
  discordId: varchar("discord_id").notNull().unique(),
  discordUsername: varchar("discord_username").notNull(),
  discordGlobalName: varchar("discord_global_name"),
  discordAvatar: varchar("discord_avatar"),
  applicationBlockedAt: timestamp("application_blocked_at", {
    withTimezone: true,
  }),
  applicationBlockedUntil: timestamp("application_blocked_until", {
    withTimezone: true,
  }),
  applicationBlockedByDiscordId: varchar("application_blocked_by_discord_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
