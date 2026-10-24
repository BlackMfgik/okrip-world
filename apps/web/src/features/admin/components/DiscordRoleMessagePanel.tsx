"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  adminDiscordOptionsSchema,
  adminDiscordRoleMessageResultSchema,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

// Порожні roleId і buttonLabel API трактує як «без кнопки» та «напис за замовчуванням».
interface RoleMessageForm {
  channelId: string;
  roleId: string;
  content: string;
  buttonLabel: string;
  suppressEmbeds: boolean;
}

const empty: RoleMessageForm = {
  channelId: "",
  roleId: "",
  content: "",
  buttonLabel: "",
  suppressEmbeds: false,
};

export function DiscordRoleMessagePanel() {
  const [form, setForm] = useState<RoleMessageForm>(empty);
  const options = useQuery({
    queryKey: queryKeys.adminDiscordOptions,
    queryFn: () =>
      apiRequest("/admin/discord/options", adminDiscordOptionsSchema),
    staleTime: 60_000,
  });
  // API віддає канали вже впорядкованими так, як у Discord; групуємо за категорією.
  const channels = options.data?.channels;
  const channelGroups = useMemo(() => {
    if (!channels) return null;
    const groups = new Map<string | null, typeof channels>();
    for (const channel of channels)
      groups.set(channel.category, [
        ...(groups.get(channel.category) ?? []),
        channel,
      ]);
    return [...groups];
  }, [channels]);
  const post = useMutation({
    mutationFn: (body: RoleMessageForm) =>
      apiRequest(
        "/admin/discord/role-message",
        adminDiscordRoleMessageResultSchema,
        body,
      ),
    onSuccess: () => setForm(empty),
  });
  const set = (
    key: "channelId" | "roleId" | "content" | "buttonLabel",
    value: string,
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className="admin-whitelist-section">
      <header className="admin-whitelist-header">
        <div>
          <strong>Повідомлення від бота</strong>
        </div>
        <p>
          Якщо вказати роль, під повідомленням буде кнопка: натискання видає
          роль, повторне — знімає.
        </p>
      </header>

      <form
        className="admin-discord-form"
        onSubmit={(event) => {
          event.preventDefault();
          post.mutate(form.roleId ? form : { ...form, buttonLabel: "" });
        }}
      >
        <label>
          <span>Канал</span>
          <select
            disabled={!channelGroups}
            onChange={(event) => set("channelId", event.target.value)}
            required
            value={form.channelId}
          >
            <option disabled value="">
              {channelGroups ? "Оберіть канал" : "Завантаження…"}
            </option>
            {channelGroups?.map(([category, channels], index) => {
              const items = channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ));
              return category ? (
                <optgroup key={index} label={category}>
                  {items}
                </optgroup>
              ) : (
                <Fragment key={index}>{items}</Fragment>
              );
            })}
          </select>
        </label>
        <label>
          <span>Роль (необов’язково)</span>
          <select
            disabled={!options.data}
            onChange={(event) => set("roleId", event.target.value)}
            value={form.roleId}
          >
            <option value="">Без кнопки</option>
            {options.data?.roles.map((role) => (
              <option key={role.id} value={role.id}>
                @{role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-discord-form-wide">
          <span>Текст повідомлення</span>
          <textarea
            maxLength={2000}
            onChange={(event) => set("content", event.target.value)}
            required
            rows={5}
            value={form.content}
          />
        </label>
        <label>
          <span>Напис на кнопці (необов’язково)</span>
          <input
            autoComplete="off"
            disabled={!form.roleId}
            maxLength={80}
            onChange={(event) => set("buttonLabel", event.target.value)}
            value={form.buttonLabel}
          />
        </label>
        <label className="admin-discord-embed-option">
          <input
            checked={form.suppressEmbeds}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                suppressEmbeds: event.target.checked,
              }))
            }
            type="checkbox"
          />
          <span>Приховати прев’ю посилань</span>
        </label>
        <button
          className="admin-button admin-button-success"
          disabled={post.isPending}
          type="submit"
        >
          {post.isPending ? "Публікуємо…" : "Опублікувати"}
        </button>
      </form>

      {options.error && (
        <p className="admin-action-error" role="alert">
          {options.error.message}{" "}
          <button
            className="admin-button"
            disabled={options.isFetching}
            onClick={() => options.refetch()}
            type="button"
          >
            Повторити
          </button>
        </p>
      )}
      {post.error && (
        <p className="admin-action-error" role="alert">
          {post.error.message}
        </p>
      )}
      {post.data && (
        <p className="admin-compact-state" role="status">
          {post.data.roleName
            ? `Опубліковано. Кнопка видає роль «${post.data.roleName}».`
            : "Опубліковано."}
        </p>
      )}
      <p className="admin-discord-hint">
        У списку ролей лише ті, які бот може видати: без адмінських прав і нижчі
        за роль бота.
      </p>
    </section>
  );
}
