"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  adminDiscordRoleMessageResultSchema,
  type AdminDiscordRoleMessage,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";

const empty: AdminDiscordRoleMessage = {
  channelId: "",
  roleId: "",
  content: "",
  buttonLabel: "Отримати роль",
};

export function DiscordRoleMessagePanel() {
  const [form, setForm] = useState<AdminDiscordRoleMessage>(empty);
  const post = useMutation({
    mutationFn: (body: AdminDiscordRoleMessage) =>
      apiRequest(
        "/admin/discord/role-message",
        adminDiscordRoleMessageResultSchema,
        body,
      ),
    onSuccess: () => setForm(empty),
  });
  const set = (key: keyof AdminDiscordRoleMessage, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className="admin-whitelist-section">
      <header className="admin-whitelist-header">
        <div>
          <strong>Кнопка видачі ролі</strong>
        </div>
        <p>
          Бот опублікує повідомлення з кнопкою. Натискання видає роль, повторне
          — знімає.
        </p>
      </header>

      <form
        className="admin-discord-form"
        onSubmit={(event) => {
          event.preventDefault();
          post.mutate(form);
        }}
      >
        <label>
          <span>ID каналу</span>
          <input
            autoComplete="off"
            inputMode="numeric"
            maxLength={20}
            minLength={17}
            onChange={(event) =>
              set("channelId", event.target.value.replace(/\D/g, ""))
            }
            pattern="\d{17,20}"
            placeholder="123456789012345678"
            required
            value={form.channelId}
          />
        </label>
        <label>
          <span>ID ролі</span>
          <input
            autoComplete="off"
            inputMode="numeric"
            maxLength={20}
            minLength={17}
            onChange={(event) =>
              set("roleId", event.target.value.replace(/\D/g, ""))
            }
            pattern="\d{17,20}"
            placeholder="123456789012345678"
            required
            value={form.roleId}
          />
        </label>
        <label className="admin-discord-form-wide">
          <span>Текст повідомлення</span>
          <textarea
            maxLength={2000}
            onChange={(event) => set("content", event.target.value)}
            placeholder="Натисніть кнопку нижче, щоб отримати роль…"
            required
            rows={5}
            value={form.content}
          />
        </label>
        <label>
          <span>Напис на кнопці</span>
          <input
            autoComplete="off"
            maxLength={80}
            onChange={(event) => set("buttonLabel", event.target.value)}
            required
            value={form.buttonLabel}
          />
        </label>
        <button
          className="admin-button admin-button-success"
          disabled={post.isPending}
          type="submit"
        >
          {post.isPending ? "Публікуємо…" : "Опублікувати"}
        </button>
      </form>

      {post.error && (
        <p className="admin-action-error" role="alert">
          {post.error.message}
        </p>
      )}
      {post.data && (
        <p className="admin-compact-state" role="status">
          Опубліковано. Кнопка видає роль «{post.data.roleName}».
        </p>
      )}
      <p className="admin-discord-hint">
        ID каналу й ролі: увімкніть у Discord «Режим розробника» (Налаштування →
        Розширені), потім ПКМ по каналу чи ролі → «Копіювати ID». Роль бота має
        стояти вище за роль, яку він видає.
      </p>
    </section>
  );
}
