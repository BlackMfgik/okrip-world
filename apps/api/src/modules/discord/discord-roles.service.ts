import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import {
  adminDiscordOptionsSchema,
  adminDiscordRoleMessageResultSchema,
  type AdminDiscordRoleMessage,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import type {
  DiscordBot,
  DiscordChannel,
  DiscordRole,
} from "./discord-bot.service.js";

const ROLE_BUTTON_PREFIX = "role:";
const SUPPRESS_EMBEDS = 1 << 2;
// Administrator, Manage Roles, Manage Guild, Ban і Kick Members: такі ролі кнопкою не видаємо.
const DANGEROUS_PERMISSIONS = 0x8n | 0x10000000n | 0x20n | 0x4n | 0x2n;
const EPHEMERAL = 64;
// Текстові канали й канали оголошень; 4 — категорія.
const POSTABLE_CHANNEL_TYPES = new Set([0, 5]);
const CATEGORY_CHANNEL_TYPE = 4;
const DEFAULT_BUTTON_LABEL = "Отримати роль";

const interactionSchema = z.object({
  type: z.number().int(),
  guild_id: z.string().optional(),
  data: z.object({ custom_id: z.string().max(100).optional() }).optional(),
  member: z
    .object({
      user: z.object({ id: z.string().regex(/^\d+$/) }),
      roles: z.array(z.string()),
    })
    .optional(),
});

function discordUnavailable() {
  return new AppError(
    503,
    "discord_unavailable",
    "Не вдалося отримати дані Discord-сервера.",
  );
}

function byPosition(a: DiscordChannel, b: DiscordChannel) {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function reply(content: string) {
  return {
    type: 4,
    data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } },
  };
}

export function discordRolesService(db: Database, env: Env, bot: DiscordBot) {
  const publicKey = env.DISCORD_PUBLIC_KEY
    ? createPublicKey({
        // DER-префікс SPKI для сирого 32-байтного Ed25519-ключа.
        key: Buffer.concat([
          Buffer.from("302a300506032b6570032100", "hex"),
          Buffer.from(env.DISCORD_PUBLIC_KEY, "hex"),
        ]),
        format: "der",
        type: "spki",
      })
    : null;

  // Службові ролі інтеграцій і ролі з адмінськими правами кнопкою не видаємо.
  const isAssignable = (role: DiscordRole) =>
    !role.managed && !(BigInt(role.permissions) & DANGEROUS_PERMISSIONS);

  async function assignableRole(roleId: string) {
    const roles = await bot.guildRoles();
    if (!roles) throw discordUnavailable();
    const role = roles.find((item) => item.id === roleId);
    if (!role || role.id === env.DISCORD_GUILD_ID)
      throw new AppError(
        404,
        "role_not_found",
        "Такої ролі немає на Discord-сервері.",
      );
    if (!isAssignable(role))
      throw new AppError(
        409,
        "role_not_allowed",
        "Цю роль не можна видавати кнопкою: вона службова або має адмінські права.",
      );
    return role;
  }

  return {
    interactionsConfigured: () => publicKey !== null,
    /** Discord підписує кожен запит Ed25519-ключем застосунку; без валідного підпису нічого не робимо. */
    verifySignature(signature: string, timestamp: string, rawBody: string) {
      if (!publicKey || !/^[0-9a-f]{128}$/i.test(signature)) return false;
      return verify(
        null,
        Buffer.from(timestamp + rawBody),
        publicKey,
        Buffer.from(signature, "hex"),
      );
    },

    /** Канали, куди можна написати, і ролі, які бот здатен видати кнопкою. */
    async options() {
      const [channels, roles, botRoleIds] = await Promise.all([
        bot.guildChannels(),
        bot.guildRoles(),
        bot.botRoleIds(),
      ]);
      if (!channels || !roles || !botRoleIds) throw discordUnavailable();

      const categories = new Map(
        channels
          .filter((channel) => channel.type === CATEGORY_CHANNEL_TYPE)
          .map((category) => [category.id, category]),
      );
      const categoryPosition = (channel: DiscordChannel) =>
        channel.parent_id
          ? (categories.get(channel.parent_id)?.position ?? -1)
          : -1;
      // Бот змінює лише ролі, що стоять нижче за його найвищу роль.
      const botTop = Math.max(
        0,
        ...roles
          .filter((role) => botRoleIds.includes(role.id))
          .map((role) => role.position),
      );

      return adminDiscordOptionsSchema.parse({
        channels: channels
          .filter((channel) => POSTABLE_CHANNEL_TYPES.has(channel.type))
          .sort(
            (a, b) =>
              categoryPosition(a) - categoryPosition(b) || byPosition(a, b),
          )
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            category:
              (channel.parent_id && categories.get(channel.parent_id)?.name) ||
              null,
          })),
        roles: roles
          .filter(
            (role) =>
              role.id !== env.DISCORD_GUILD_ID &&
              role.position < botTop &&
              isAssignable(role),
          )
          .sort((a, b) => b.position - a.position)
          .map((role) => ({ id: role.id, name: role.name })),
      });
    },

    async postRoleMessage(
      input: AdminDiscordRoleMessage,
      admin: { id: string; discordId: string },
    ) {
      const role = input.roleId ? await assignableRole(input.roleId) : null;

      const posted = await bot.postMessage(input.channelId, {
        content: input.content,
        ...(input.suppressEmbeds ? { flags: SUPPRESS_EMBEDS } : {}),
        allowed_mentions: { parse: [] },
        ...(role && {
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 1,
                  label: input.buttonLabel ?? DEFAULT_BUTTON_LABEL,
                  custom_id: ROLE_BUTTON_PREFIX + role.id,
                },
              ],
            },
          ],
        }),
      });
      if (!posted.id)
        throw new AppError(
          posted.status === 404 ? 404 : 409,
          "discord_post_failed",
          posted.status === 404
            ? "Канал не знайдено. Перевірте ID каналу."
            : posted.status === 403
              ? "Бот не може писати в цей канал. Дайте йому право надсилати повідомлення."
              : "Discord не прийняв повідомлення.",
        );
      await audit(db, {
        actorType: "user",
        actorId: admin.id,
        eventType: "discord_role_message_posted",
        entityType: "user",
        entityId: admin.id,
        metadata: {
          messageId: posted.id,
          actorDiscordId: admin.discordId,
          channelId: input.channelId,
          roleId: role?.id ?? null,
        },
      });
      return adminDiscordRoleMessageResultSchema.parse({
        messageId: posted.id,
        channelId: input.channelId,
        roleName: role?.name,
      });
    },

    async handleInteraction(payload: unknown) {
      const interaction = interactionSchema.parse(payload);
      if (interaction.type === 1) return { type: 1 };
      const customId = interaction.data?.custom_id ?? "";
      const roleId = customId.slice(ROLE_BUTTON_PREFIX.length);
      if (
        interaction.type !== 3 ||
        !customId.startsWith(ROLE_BUTTON_PREFIX) ||
        !/^\d{17,20}$/.test(roleId) ||
        interaction.guild_id !== env.DISCORD_GUILD_ID ||
        !interaction.member
      )
        return reply("⚠️ Ця кнопка більше не працює.");
      // Повторне натискання знімає роль.
      const has = interaction.member.roles.includes(roleId);
      const status = await bot.setMemberRole(
        interaction.member.user.id,
        roleId,
        !has,
      );
      // Згадка ролі у прихованій відповіді показує її назву й нікого не пінгує.
      const role = `<@&${roleId}>`;
      if (status === 204)
        return reply(
          has
            ? `❌ Роль ${role} знято.\nЩоб повернути її, натисни кнопку ще раз.`
            : `✅ Ти отримав роль ${role}!\nЩоб зняти її, натисни кнопку ще раз.`,
        );
      if (status === 403)
        return reply(
          `⚠️ Бот не може ${has ? "зняти" : "видати"} роль ${role}: його роль стоїть нижче. Напиши адміністрації.`,
        );
      return reply("⚠️ Не вдалося змінити роль. Спробуй ще раз за хвилину.");
    },
  };
}
