import type { Executor } from "../../db/client.js";
import { banEvents } from "../../db/schema.js";
export const recordBanEvent = (
  db: Executor,
  eventId: string,
  serverId: string,
) =>
  db
    .insert(banEvents)
    .values({ eventId, serverId })
    .onConflictDoNothing()
    .returning();
