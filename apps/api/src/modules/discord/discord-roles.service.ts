import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import {
  adminDiscordRoleMessageResultSchema,
  type AdminDiscordRoleMessage,
} from "@okrip/contracts";
import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { audit } from "../audit/index.js";
import type { DiscordBot } from "./discord-bot.service.js";

const ROLE_BUTTON_PREFIX = "role:";
// Administrator, Manage Roles, Manage Guild, Ban і Kick Members: такі ролі кнопкою не видаємо.
const DANGEROUS_PERMISSIONS = 0x8n | 0x10000000n | 0x20n | 0x4n | 0x2n;
const EPHEMERAL = 64;

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

    async postRoleMessage(
      input: AdminDiscordRoleMessage,
      admin: { id: string; discordId: string },
    ) {
      const roles = await bot.guildRoles();
      if (!roles)
        throw new AppError(
          503,
          "discord_unavailable",
          "Не вдалося отримати ролі Discord-сервера.",
        );
      const role = roles.find((item) => item.id === input.roleId);
      if (!role || role.id === env.DISCORD_GUILD_ID)
        throw new AppError(
          404,
          "role_not_found",
          "Такої ролі немає на Discord-сервері.",
        );
      if (role.managed || BigInt(role.permissions) & DANGEROUS_PERMISSIONS)
        throw new AppError(
          409,
          "role_not_allowed",
          "Цю роль не можна видавати кнопкою: вона службова або має адмінські права.",
        );

      const posted = await bot.postMessage(input.channelId, {
        content: input.content,
        allowed_mentions: { parse: [] },
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: input.buttonLabel,
                custom_id: ROLE_BUTTON_PREFIX + role.id,
              },
            ],
          },
        ],
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
          roleId: role.id,
        },
      });
      return adminDiscordRoleMessageResultSchema.parse({
        messageId: posted.id,
        channelId: input.channelId,
        roleName: role.name,
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
