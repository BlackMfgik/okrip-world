import { pgEnum, uuid, timestamp } from "drizzle-orm/pg-core";
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const accessStatus = pgEnum("access_status", [
  "active",
  "revoked",
  "banned",
]);
export const commandStatus = pgEnum("command_status", [
  "pending",
  "leased",
  "completed",
  "failed",
]);
export const commandType = pgEnum("command_type", [
  "whitelist_add",
  "whitelist_remove",
  "kick",
  "ban",
]);
export const actorType = pgEnum("actor_type", [
  "user",
  "telegram_admin",
  "system",
  "minecraft_server",
]);
export const id = () => uuid("id").primaryKey().defaultRandom();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
