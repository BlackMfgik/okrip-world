import type { Database } from "../../db/client.js";
import type { Env } from "../../config/env.js";
import type { TelegramProvider } from "./telegram-message.service.js";
import * as repo from "./telegram-job.repository.js";

const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formattedDate(value: Date) {
  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function formattedStatus(status: string, moderatorName: string | null) {
  if (status === "approved")
    return [
      "✅Статус: Схвалено",
      ...(moderatorName ? ["👤Схвалив: " + moderatorName] : []),
    ].join("\n");
  if (status === "rejected") return "❌Статус: Відхилено";
  if (status === "cancelled") return "❌Статус: Скасовано";
  return "⏳Статус: Очікує рішення";
}

export function telegramWorker(
  db: Database,
  env: Env,
  telegram: TelegramProvider,
) {
  let running = false;
  return {
    async tick() {
      if (
        running ||
        !env.TELEGRAM_ADMIN_CHAT_ID ||
        !env.TELEGRAM_ADMIN_USER_IDS
      )
        return;
      running = true;
      try {
        const job = await db.transaction((tx) => repo.takeJob(tx));
        if (!job) return;
        const { app, identity, user } = await repo.messageData(
          db,
          job.applicationId,
        );
        if (job.kind === "delete") {
          await repo.finishJob(db, job.id);
          return;
        }
        const text = [
          "🧾Заявка №" + app.number,
          "🔵Discord: " + user.discordUsername,
          "💰Нікнейм: " + identity.username,
          "🗓Дата: " + formattedDate(app.createdAt),
          formattedStatus(app.status, app.reviewedByTelegramName),
          ...(app.status === "rejected" && app.rejectionReason
            ? ["📝Причина: " + app.rejectionReason]
            : []),
        ].join("\n");
        const buttons = {
          inline_keyboard:
            app.status === "pending"
              ? [
                  [
                    {
                      text: "✅ Схвалити",
                      callback_data: "approve:" + app.publicId,
                    },
                    {
                      text: "❌ Відхилити",
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
