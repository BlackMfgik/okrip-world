import type { Env } from "../../config/env.js";
import { externalRequest } from "../../shared/http.js";

const API = "https://discord.com/api/v10";

export interface DiscordRole {
  id: string;
  name: string;
  permissions: string;
  managed: boolean;
  position: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  flags?: number;
  author: { id: string };
  components?: {
    type: number;
    components?: { type: number; label?: string; custom_id?: string }[];
  }[];
}

/** REST-виклики від імені бота. Повертають HTTP-статус, щоб сервіс сам дав зрозумілу помилку. */
export interface DiscordBot {
  /** retries — кількість повторів; для відповіді на кнопку 0, бо Discord чекає лише 3 секунди. */
  guildRoles(retries?: number): Promise<DiscordRole[] | null>;
  guildChannels(): Promise<DiscordChannel[] | null>;
  /** Ролі самого бота на сервері: від найвищої залежить, які ролі він може видати. */
  botRoleIds(): Promise<string[] | null>;
  postMessage(
    channelId: string,
    body: unknown,
  ): Promise<{ status: number; id?: string }>;
  getMessage(
    channelId: string,
    messageId: string,
  ): Promise<{ status: number; message?: DiscordMessage }>;
  editMessage(
    channelId: string,
    messageId: string,
    body: unknown,
  ): Promise<number>;
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
    async guildRoles(retries) {
      const response = await externalRequest(
        `${API}/guilds/${env.DISCORD_GUILD_ID}/roles`,
        { headers },
        retries,
      );
      if (!response.ok) return null;
      return (await response.json()) as DiscordRole[];
    },
    async guildChannels() {
      const response = await externalRequest(
        `${API}/guilds/${env.DISCORD_GUILD_ID}/channels`,
        { headers },
      );
      if (!response.ok) return null;
      return (await response.json()) as DiscordChannel[];
    },
    async botRoleIds() {
      // ID застосунку збігається з ID його бота.
      const response = await externalRequest(
        `${API}/guilds/${env.DISCORD_GUILD_ID}/members/${env.DISCORD_CLIENT_ID}`,
        { headers },
      );
      if (!response.ok) return null;
      return ((await response.json()) as { roles: string[] }).roles;
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
    async getMessage(channelId, messageId) {
      const response = await externalRequest(
        `${API}/channels/${channelId}/messages/${messageId}`,
        { headers },
      );
      if (!response.ok) {
        await response.body?.cancel();
        return { status: response.status };
      }
      return {
        status: response.status,
        message: (await response.json()) as DiscordMessage,
      };
    },
    async editMessage(channelId, messageId, body) {
      const response = await externalRequest(
        `${API}/channels/${channelId}/messages/${messageId}`,
        { method: "PATCH", headers, body: JSON.stringify(body) },
        0,
      );
      await response.body?.cancel();
      return response.status;
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
