import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  bigserial,
} from "drizzle-orm/pg-core";
import type { MinecraftCommand } from "@okrip/contracts";
import { id, createdAt, commandStatus, commandType } from "./common.js";
import { playerAccess } from "./player-access.js";
export const commands = pgTable(
  "minecraft_commands",
  {
    id: id(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    serverId: varchar("server_id").notNull(),
    playerAccessId: uuid("player_access_id")
      .notNull()
      .references(() => playerAccess.id),
    type: commandType("type").notNull(),
    payload: jsonb("payload").$type<MinecraftCommand["payload"]>().notNull(),
    status: commandStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("command_poll").on(t.serverId, t.status, t.createdAt)],
);
