import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { equalSecret } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { moderationService } from "./moderation.service.js";
import type { TelegramProvider } from "./telegram-message.service.js";
const telegramUser = z.object({
  id: z.number().int().safe(),
  is_bot: z.boolean().optional(),
  username: z.string().max(64).optional(),
  first_name: z.string().max(64).optional(),
  last_name: z.string().max(64).optional(),
});
type TelegramUser = z.infer<typeof telegramUser>;
function moderatorName(user: TelegramUser) {
  if (user.username) return "@" + user.username;
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    String(user.id)
  );
}
const webhook = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int().optional(),
      text: z.string().optional(),
      from: telegramUser.optional(),
      chat: z.object({ id: z.number().int().safe() }),
      reply_to_message: z
        .object({
          text: z.string().optional(),
          from: z.object({ is_bot: z.boolean().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: telegramUser,
      data: z.string().max(64),
      message: z.object({
        message_id: z.number().int(),
        chat: z.object({ id: z.number().int().safe() }),
      }),
    })
    .optional(),
});
export function telegramRoutes(
  app: FastifyInstance,
  env: Env,
  service: ReturnType<typeof moderationService>,
  telegram: TelegramProvider,
) {
  app.post(
    "/v1/integrations/telegram/webhook",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req) => {
      if (
        !equalSecret(
          String(req.headers["x-telegram-bot-api-secret-token"] ?? ""),
          env.TELEGRAM_WEBHOOK_SECRET,
        )
      )
        throw new AppError(401, "unauthorized", "Unauthorized");
      const update = webhook.parse(req.body);
      const message = update.message;
      if (
        (!env.TELEGRAM_ADMIN_CHAT_ID || !env.TELEGRAM_ADMIN_USER_IDS) &&
        message?.from &&
        !message.from.is_bot &&
        /^\/(?:start|ids)(?:@\w+)?\s*$/.test(message.text ?? "")
      ) {
        await telegram.call("sendMessage", {
          chat_id: message.chat.id,
          text: `Режим налаштування Okrip World\nTELEGRAM_ADMIN_CHAT_ID=${message.chat.id}\nВаш TELEGRAM_ADMIN_USER_IDS=${message.from.id}\nЦя команда не надає прав модератора.`,
        });
      }
      const rejectionId = /(?:^|\n)#reject:([A-Za-z0-9_-]{16})$/.exec(
        message?.reply_to_message?.text ?? "",
      )?.[1];
      if (
        rejectionId &&
        message?.text &&
        message.from &&
        !message.from.is_bot &&
        message.reply_to_message?.from?.is_bot === true
      ) {
        const application = await service.prepareRejection(
          rejectionId,
          String(message.from.id),
          String(message.chat.id),
        );
        if (application.status !== "pending") {
          await telegram.call("sendMessage", {
            chat_id: message.chat.id,
            text: "Заявку вже було розглянуто: " + application.status,
            ...(message.message_id
              ? { reply_parameters: { message_id: message.message_id } }
              : {}),
          });
          return { ok: true };
        }
        const result = await service.decide(
          rejectionId,
          "reject",
          String(message.from.id),
          String(message.chat.id),
          message.text,
          moderatorName(message.from),
        );
        await telegram.call("sendMessage", {
          chat_id: message.chat.id,
          text:
            result === "rejected"
              ? "❌ Причину збережено. Заявку відхилено."
              : "Заявку вже було розглянуто: " + result,
          ...(message.message_id
            ? { reply_parameters: { message_id: message.message_id } }
            : {}),
        });
        return { ok: true };
      }
      const callback = update.callback_query;
      if (!callback) return { ok: true };
      const match = /^(approve|reject):([A-Za-z0-9_-]{16})$/.exec(
        callback.data,
      );
      if (!match)
        throw new AppError(400, "invalid_callback", "Invalid callback");
      if (match[1] === "reject") {
        const application = await service.prepareRejection(
          match[2]!,
          String(callback.from.id),
          String(callback.message.chat.id),
        );
        if (application.status === "pending") {
          await telegram.call("sendMessage", {
            chat_id: callback.message.chat.id,
            text: `Схуялє відхилити заявку №${application.number}?\n#reject:${match[2]}`,
            reply_parameters: { message_id: callback.message.message_id },
            reply_markup: {
              force_reply: true,
              input_field_placeholder: "Причина відмови",
            },
          });
        }
        await telegram
          .call("answerCallbackQuery", {
            callback_query_id: callback.id,
            text:
              application.status === "pending"
                ? "Введіть причину відмови"
                : "Заявку вже розглянуто: " + application.status,
          })
          .catch(() => undefined);
        return { ok: true };
      }
      const result = await service.decide(
        match[2]!,
        "approve",
        String(callback.from.id),
        String(callback.message.chat.id),
        undefined,
        moderatorName(callback.from),
      );
      // Acknowledgement is cosmetic; the durable decision/message job already committed.
      await telegram
        .call("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: result,
        })
        .catch(() => undefined);
      return { ok: true };
    },
  );
}
