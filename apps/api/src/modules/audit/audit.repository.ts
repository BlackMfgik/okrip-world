import type { Executor } from "../../db/client.js";
import { auditEvents } from "../../db/schema.js";
export const audit = (db: Executor, event: typeof auditEvents.$inferInsert) =>
  db.insert(auditEvents).values(event);
