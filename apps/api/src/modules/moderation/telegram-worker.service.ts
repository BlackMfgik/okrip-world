import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import type { TelegramProvider } from "./telegram-message.service.js";
import * as repo from "./telegram-job.repository.js";
export function telegramWorker(
  db: Database,
  env: Env,
  telegram: TelegramProvider,
) {
  let running = false;
  return {
    async tick() {
      if (running) return;
      running = true;
      try {
        const job = await db.transaction((tx) => repo.takeJob(tx));
        if (!job) return;
        const { app, identity, user } = await repo.messageData(
          db,
          job.applicationId,
        );
        const text = [
          "Заявка " + app.publicId,
          "Discord: " + user.discordUsername + " (" + user.discordId + ")",
          "Minecraft: " + identity.username,
          "Дата: " + app.createdAt.toISOString(),
          "Статус: " + app.status,
        ].join("\n");
        const buttons = {
          inline_keyboard:
            app.status === "pending"
              ? [
                  [
                    {
                      text: "Схвалити",
                      callback_data: "approve:" + app.publicId,
                    },
                    {
                      text: "Відхилити",
                      callback_data: "reject:" + app.publicId,
                    },
                  ],
                ]
              : [],
        };
        if (job.kind === "created" && !app.telegramMessageId) {
          const sent = await telegram.call("sendMessage", {
            chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
            text,
            reply_markup: buttons,
          });
          if (!sent.message_id) throw new Error("Missing Telegram message ID");
          await repo.recordMessage(
            db,
            app.id,
            env.TELEGRAM_ADMIN_CHAT_ID,
            sent.message_id,
          );
        } else if (app.telegramMessageId) {
          await telegram.call("editMessageText", {
            chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
            message_id: app.telegramMessageId,
            text,
            reply_markup: buttons,
          });
        } else {
          return;
        }
        await repo.finishJob(db, job.id);
      } finally {
        running = false;
      }
    },
  };
}
