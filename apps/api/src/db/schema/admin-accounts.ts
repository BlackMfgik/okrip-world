import { pgTable, varchar } from "drizzle-orm/pg-core";
import { createdAt } from "./common.js";

export const adminAccounts = pgTable("admin_accounts", {
  discordId: varchar("discord_id").primaryKey(),
  createdAt: createdAt(),
});
