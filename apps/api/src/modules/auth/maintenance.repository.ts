import { lt } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { oauthStates, sessions } from "../../db/schema.js";
export async function cleanupExpired(db: Database) {
  await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
