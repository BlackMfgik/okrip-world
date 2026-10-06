import type { Database } from "../../db/client.js";
import type { DiscordProvider } from "./discord.service.js";
import { saveDiscordMembership } from "./auth.repository.js";

type Member = {
  id: string;
  discordId: string;
  discordGuildJoinedAt: Date | null;
};
const MAX_LOOKUPS = 4;
const RETRY_AFTER_MS = 5 * 60_000;

export function discordMembershipEnricher(
  db: Database,
  discord: DiscordProvider,
) {
  const inFlight = new Map<string, Promise<Date | null>>();
  const retryAfter = new Map<string, number>();

  async function lookup(user: Member): Promise<Date | null> {
    try {
      const { joinedAt } = await discord.membership(user.discordId, {
        retries: 0,
      });
      if (joinedAt) {
        await saveDiscordMembership(db, user.id, joinedAt);
        return joinedAt;
      }
    } catch {
      // Optional enrichment must not prevent moderators from reviewing applications.
    }
    retryAfter.set(user.id, Date.now() + RETRY_AFTER_MS);
    return null;
  }

  return async (members: Member[]) => {
    const now = Date.now();
    for (const [id, expiresAt] of retryAfter) {
      if (expiresAt <= now) retryAfter.delete(id);
    }
    const results = new Map<string, Date>();
    const waiting: Promise<void>[] = [];
    const seen = new Set<string>();
    let started = 0;
    for (const user of members) {
      if (user.discordGuildJoinedAt || seen.has(user.id)) continue;
      seen.add(user.id);
      let pending = inFlight.get(user.id);
      if (!pending) {
        if (
          retryAfter.has(user.id) ||
          started >= MAX_LOOKUPS ||
          inFlight.size >= MAX_LOOKUPS
        )
          continue;
        started++;
        pending = lookup(user).finally(() => inFlight.delete(user.id));
        inFlight.set(user.id, pending);
      }
      waiting.push(
        pending.then((joinedAt) => {
          if (joinedAt) results.set(user.id, joinedAt);
        }),
      );
    }
    await Promise.all(waiting);
    return results;
  };
}
