import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import { randomToken, tokenHash } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { DiscordProvider } from "./discord.service.js";
import * as repo from "./auth.repository.js";
import { audit } from "../audit/audit.repository.js";
export function authService(db: Database, env: Env, discord: DiscordProvider) {
  const hash = (v: string) => tokenHash(v, env.SESSION_SECRET);
  return {
    async start() {
      const state = randomToken(),
        browser = randomToken();
      await repo.saveState(db, hash(state), hash(browser));
      const url = new URL("https://discord.com/oauth2/authorize");
      url.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify",
        state,
      }).toString();
      return { url: url.toString(), browser };
    },
    async callback(code: string, state: string, browser: string) {
      if (!(await repo.consumeState(db, hash(state), hash(browser))).length)
        throw new AppError(
          400,
          "invalid_state",
          "Спробуйте увійти через Discord ще раз.",
        );
      const profile = await discord.identity(code);
      await discord.membership(profile.id);
      const token = randomToken();
      await db.transaction(async (tx) => {
        const user = await repo.upsertUser(tx, profile);
        await repo.saveSession(tx, user.id, hash(token));
        await audit(tx, {
          actorType: "user",
          actorId: user.id,
          eventType: "login",
          entityType: "user",
          entityId: user.id,
        });
      });
      return token;
    },
    async current(token?: string) {
      return token ? repo.findSession(db, hash(token)) : undefined;
    },
    async logout(token?: string) {
      if (token) await repo.deleteSession(db, hash(token));
    },
  };
}
export type AuthService = ReturnType<typeof authService>;
