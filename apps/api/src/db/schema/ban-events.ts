import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt } from "./common.js";

export const banEvents = pgTable("ban_events", {
  eventId: uuid("event_id").primaryKey(),
  serverId: varchar("server_id").notNull(),
  createdAt: createdAt(),
});
