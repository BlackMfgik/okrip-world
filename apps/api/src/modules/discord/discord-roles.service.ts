import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import {
  adminDiscordOptionsSchema,
  adminDiscordRoleMessageDetailsSchema,
  adminDiscordRoleMessageResultSchema,
  type AdminDiscordMessageRef,
  type AdminDiscordRoleMessage,
  type AdminDiscordRoleMessageEdit,
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
// Запит Discord із старішою міткою часу вважаємо повтором перехопленого запиту.
const MAX_INTERACTION_AGE_SECONDS = 300;

const interactionSchema = z.object({
  type: z.number().int(),
  guild_id: z.string().optional(),
  data: z.object({ custom_id: z.string().max(100).optional() }).optional(),
  member: z
    .object({
      user: z.object({ id: z.string().regex(/^\d+$/) }),
      // На Discord-сервері не більше 250 ролей.
      roles: z.array(z.string().max(20)).max(250),
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

/** Тіло повідомлення бота для публікації й редагування; без ролі — без кнопки. */
function messageBody(input: AdminDiscordRoleMessage, role: DiscordRole | null) {
  return {
    content: input.content,
    allowed_mentions: { parse: [] },
    components: role
      ? [
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
        ]
      : [],
  };
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

  /** Повідомлення, яке бот написав у текстовому каналі цього сервера: лише такі можна редагувати. */
  async function ownMessage({ channelId, messageId }: AdminDiscordMessageRef) {
    const channels = await bot.guildChannels();
    if (!channels) throw discordUnavailable();
    if (
      !channels.some(
        (channel) =>
          channel.id === channelId && POSTABLE_CHANNEL_TYPES.has(channel.type),
      )
    )
      throw new AppError(
        404,
        "discord_message_not_found",
        "Канал не знайдено на Discord-сервері.",
      );
    const result = await bot.getMessage(channelId, messageId);
    if (!result.message)
      throw result.status === 404 || result.status === 403
        ? new AppError(
            404,
            "discord_message_not_found",
            "Повідомлення не знайдено. Перевірте посилання.",
          )
        : discordUnavailable();
    // ID застосунку збігається з ID його бота; чужі повідомлення Discord редагувати не дає.
    if (result.message.author.id !== env.DISCORD_CLIENT_ID)
      throw new AppError(
        409,
        "discord_message_not_own",
        "Редагувати можна лише повідомлення, які написав бот.",
      );
    return result.message;
  }

  return {
    interactionsConfigured: () => publicKey !== null,
    /** Discord підписує кожен запит Ed25519-ключем застосунку; без валідного підпису нічого не робимо. */
    verifySignature(signature: string, timestamp: string, rawBody: string) {
      if (
        !publicKey ||
        !/^[0-9a-f]{128}$/i.test(signature) ||
        !/^\d{1,12}$/.test(timestamp) ||
        Math.abs(Date.now() / 1000 - Number(timestamp)) >
          MAX_INTERACTION_AGE_SECONDS
      )
        return false;
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
        ...messageBody(input, role),
        ...(input.suppressEmbeds ? { flags: SUPPRESS_EMBEDS } : {}),
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

    /** Поточний текст, кнопка ролі й прев'ю посилань повідомлення бота — для форми редагування. */
    async roleMessage(ref: AdminDiscordMessageRef) {
      const message = await ownMessage(ref);
      const button = message.components
        ?.flatMap((row) => row.components ?? [])
        .find((item) => item.custom_id?.startsWith(ROLE_BUTTON_PREFIX));
      return adminDiscordRoleMessageDetailsSchema.parse({
        messageId: message.id,
        channelId: ref.channelId,
        content: message.content,
        roleId: button?.custom_id?.slice(ROLE_BUTTON_PREFIX.length) ?? null,
        buttonLabel: button?.label ?? null,
        suppressEmbeds: Boolean((message.flags ?? 0) & SUPPRESS_EMBEDS),
      });
    },

    async editRoleMessage(
      input: AdminDiscordRoleMessageEdit,
      admin: { id: string; discordId: string },
    ) {
      await ownMessage(input);
      const role = input.roleId ? await assignableRole(input.roleId) : null;
      // components: [] прибирає кнопку, flags: 0 повертає прев'ю посилань.
      const status = await bot.editMessage(input.channelId, input.messageId, {
        ...messageBody(input, role),
        flags: input.suppressEmbeds ? SUPPRESS_EMBEDS : 0,
      });
      if (status < 200 || status >= 300)
        throw new AppError(
          status === 404 ? 404 : 409,
          "discord_edit_failed",
          status === 404
            ? "Повідомлення вже видалено."
            : status === 403
              ? "Бот не може редагувати це повідомлення."
              : "Discord не прийняв зміни.",
        );
      await audit(db, {
        actorType: "user",
        actorId: admin.id,
        eventType: "discord_role_message_edited",
        entityType: "user",
        entityId: admin.id,
        metadata: {
          messageId: input.messageId,
          actorDiscordId: admin.discordId,
          channelId: input.channelId,
          roleId: role?.id ?? null,
        },
      });
      return adminDiscordRoleMessageResultSchema.parse({
        messageId: input.messageId,
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
      // Повторне натискання знімає роль. Зняти можна завжди, а перед видачею перевіряємо роль
      // ще раз: після публікації кнопки їй могли дати адмінські права або видалити її.
      const has = interaction.member.roles.includes(roleId);
      if (!has) {
        const roles = await bot.guildRoles(0);
        if (!roles)
          return reply(
            "⚠️ Не вдалося змінити роль. Спробуй ще раз за хвилину.",
          );
        const target = roles.find((item) => item.id === roleId);
        if (
          !target ||
          target.id === env.DISCORD_GUILD_ID ||
          !isAssignable(target)
        )
          return reply("⚠️ Ця кнопка більше не працює. Напиши адміністрації.");
      }
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
