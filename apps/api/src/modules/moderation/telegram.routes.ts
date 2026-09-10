import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { equalSecret } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { moderationService } from "./moderation.service.js";
import type { TelegramProvider } from "./telegram-message.service.js";
const webhook = z.object({
  update_id: z.number().int(),
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({ id: z.number().int().safe() }),
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
      const callback = webhook.parse(req.body).callback_query;
      if (!callback) return { ok: true };
      const match = /^(approve|reject):([A-Za-z0-9_-]{16})$/.exec(
        callback.data,
      );
      if (!match)
        throw new AppError(400, "invalid_callback", "Invalid callback");
      const result = await service.decide(
        match[2]!,
        match[1] as "approve" | "reject",
        String(callback.from.id),
        String(callback.message.chat.id),
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
