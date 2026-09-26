import type { Env } from "../../config/env.js";
import { externalRequest } from "../../shared/http.js";

const API = "https://discord.com/api/v10";

export interface DiscordRole {
  id: string;
  name: string;
  permissions: string;
  managed: boolean;
}

/** REST-виклики від імені бота. Повертають HTTP-статус, щоб сервіс сам дав зрозумілу помилку. */
export interface DiscordBot {
  guildRoles(): Promise<DiscordRole[] | null>;
  postMessage(
    channelId: string,
    body: unknown,
  ): Promise<{ status: number; id?: string }>;
  setMemberRole(
    userId: string,
    roleId: string,
    present: boolean,
  ): Promise<number>;
}

export function discordBot(env: Env): DiscordBot {
  const headers = {
    Authorization: "Bot " + env.DISCORD_BOT_TOKEN,
    "Content-Type": "application/json",
  };
  return {
    async guildRoles() {
      const response = await externalRequest(
        `${API}/guilds/${env.DISCORD_GUILD_ID}/roles`,
        { headers },
      );
      if (!response.ok) return null;
      return (await response.json()) as DiscordRole[];
    },
    async postMessage(channelId, body) {
      const response = await externalRequest(
        `${API}/channels/${channelId}/messages`,
        { method: "POST", headers, body: JSON.stringify(body) },
        0,
      );
      if (!response.ok) {
        await response.body?.cancel();
        return { status: response.status };
      }
      const message = (await response.json()) as { id: string };
      return { status: response.status, id: message.id };
    },
    async setMemberRole(userId, roleId, present) {
      // Відповідь на натискання кнопки має дійти до Discord за 3 секунди, тому без повторів.
      const response = await externalRequest(
        `${API}/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`,
        { method: present ? "PUT" : "DELETE", headers },
        0,
      );
      await response.body?.cancel();
      return response.status;
    },
  };
}
