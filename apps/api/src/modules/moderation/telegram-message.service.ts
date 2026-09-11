import { z } from "zod";
import type { Env } from "../../config/env.js";
import { externalRequest } from "../../shared/http.js";
import { AppError } from "../../shared/errors.js";
export interface TelegramProvider {
  call(
    method: string,
    body: Record<string, unknown>,
  ): Promise<{ message_id?: number }>;
}
export function telegramProvider(env: Env): TelegramProvider {
  return {
    async call(method, body) {
      const response = await externalRequest(
        "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        method === "sendMessage" ? 0 : 2,
      );
      const result = z
        .object({
          ok: z.boolean(),
          result: z
            .union([
              z.boolean(),
              z.object({ message_id: z.number().optional() }),
            ])
            .optional(),
          description: z.string().optional(),
        })
        .safeParse(await response.json());
      if (
        result.success &&
        !result.data.ok &&
        method === "editMessageText" &&
        result.data.description?.includes("message is not modified")
      )
        return {};
      if (!response.ok || !result.success || !result.data.ok)
        throw new AppError(
          503,
          "telegram_unavailable",
          "Telegram тимчасово недоступний.",
        );
      return typeof result.data.result === "object" ? result.data.result : {};
    },
  };
}
