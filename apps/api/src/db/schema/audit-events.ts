import { pgTable, uuid, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { id, createdAt, actorType } from "./common.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorType: actorType("actor_type").notNull(),
    actorId: varchar("actor_id"),
    eventType: varchar("event_type").notNull(),
    entityType: varchar("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity").on(t.entityType, t.entityId, t.createdAt)],
);
