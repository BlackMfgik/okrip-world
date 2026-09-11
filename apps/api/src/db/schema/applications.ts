import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigserial,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt, applicationStatus } from "./common.js";
import { users } from "./users.js";
import { identities } from "./minecraft-identities.js";
export const applications = pgTable(
  "applications",
  {
    id: id(),
    number: bigserial("number", { mode: "number" }).notNull().unique(),
    publicId: varchar("public_id").unique().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    minecraftIdentityId: uuid("minecraft_identity_id")
      .notNull()
      .references(() => identities.id),
    status: applicationStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    telegramChatId: varchar("telegram_chat_id"),
    telegramMessageId: integer("telegram_message_id"),
    reviewedByTelegramId: varchar("reviewed_by_telegram_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("one_pending_application")
      .on(t.userId)
      .where(sql`status = 'pending'`),
    index("application_user_status").on(t.userId, t.status),
  ],
);
