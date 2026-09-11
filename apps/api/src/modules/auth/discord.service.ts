import { z } from "zod";
import type { Env } from "../../config/env.js";
import { externalRequest } from "../../shared/http.js";
import { AppError } from "../../shared/errors.js";
const identitySchema = z.object({
  id: z.string().regex(/^\d+$/),
  username: z.string(),
  global_name: z.string().nullable(),
  avatar: z.string().nullable(),
});
export type DiscordIdentity = z.infer<typeof identitySchema>;
export const DISCORD_MEMBERSHIP_CHECK_ENABLED = false;

export interface DiscordProvider {
  identity(code: string): Promise<DiscordIdentity>;
  membership(discordId: string): Promise<void>;
}
export function discordProvider(env: Env): DiscordProvider {
  return {
    async identity(code) {
      const response = await externalRequest(
        "https://discord.com/api/v10/oauth2/token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: env.DISCORD_REDIRECT_URI,
          }),
        },
        0,
      );
      if (!response.ok)
        throw new AppError(
          400,
          "oauth_failed",
          "Не вдалося увійти через Discord.",
        );
      const { access_token } = z
        .object({ access_token: z.string() })
        .parse(await response.json());
      const profile = await externalRequest(
        "https://discord.com/api/v10/users/@me",
        { headers: { Authorization: "Bearer " + access_token } },
      );
      if (!profile.ok)
        throw new AppError(
          503,
          "discord_unavailable",
          "Discord тимчасово недоступний.",
        );
      return identitySchema.parse(await profile.json());
    },
    async membership(discordId) {
      const response = await externalRequest(
        "https://discord.com/api/v10/guilds/" +
          env.DISCORD_GUILD_ID +
          "/members/" +
          discordId,
        { headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN } },
      );
      if (response.status === 404)
        throw new AppError(
          403,
          "guild_required",
          "Спочатку приєднайтеся до Discord-сервера Okrip World.",
        );
      if (!response.ok)
        throw new AppError(
          503,
          "discord_unavailable",
          "Не вдалося перевірити членство в Discord.",
        );
      const member = z
        .object({ pending: z.boolean().optional() })
        .parse(await response.json());
      if (member.pending)
        throw new AppError(
          403,
          "guild_screening",
          "Завершіть перевірку учасника в Discord.",
        );
    },
  };
}
