"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  adminDiscordOptionsSchema,
  adminDiscordRoleMessageDetailsSchema,
  adminDiscordRoleMessageResultSchema,
  type AdminDiscordMessageRef,
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

// «Копіювати посилання на повідомлення» в Discord: …/channels/<сервер>/<канал>/<повідомлення>.
const MESSAGE_LINK = /\/channels\/(?:\d+|@me)\/(\d{17,20})\/(\d{17,20})\/?$/;

export function parseMessageLink(link: string): AdminDiscordMessageRef | null {
  const match = MESSAGE_LINK.exec(link.trim());
  return match ? { channelId: match[1]!, messageId: match[2]! } : null;
}

export function DiscordRoleMessagePanel() {
  const [form, setForm] = useState<RoleMessageForm>(empty);
  // Повідомлення, яке зараз редагується; null — публікуємо нове.
  const [editing, setEditing] = useState<AdminDiscordMessageRef | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
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
  const load = useMutation({
    mutationFn: (ref: AdminDiscordMessageRef) =>
      apiRequest(
        "/admin/discord/role-message?" + new URLSearchParams({ ...ref }),
        adminDiscordRoleMessageDetailsSchema,
      ),
    onSuccess: (message) => {
      save.reset();
      setEditing({
        channelId: message.channelId,
        messageId: message.messageId,
      });
      setForm({
        channelId: message.channelId,
        roleId: message.roleId ?? "",
        content: message.content,
        buttonLabel: message.buttonLabel ?? "",
        suppressEmbeds: message.suppressEmbeds,
      });
      setLink("");
    },
  });
  const save = useMutation({
    mutationFn: (body: RoleMessageForm) =>
      editing
        ? apiRequest(
            "/admin/discord/role-message/edit",
            adminDiscordRoleMessageResultSchema,
            { ...body, messageId: editing.messageId },
          )
        : apiRequest(
            "/admin/discord/role-message",
            adminDiscordRoleMessageResultSchema,
            body,
          ),
    onSuccess: () => {
      if (!editing) setForm(empty);
    },
  });
  const set = (
    key: "channelId" | "roleId" | "content" | "buttonLabel",
    value: string,
  ) => setForm((current) => ({ ...current, [key]: value }));
  const stopEditing = () => {
    setEditing(null);
    setForm(empty);
    save.reset();
    load.reset();
  };
  const saved = save.data;
  // Роль кнопки могли зробити адмінською чи видалити: показуємо її, щоб форма не скидала вибір мовчки.
  const unknownRole =
    form.roleId !== "" &&
    options.data !== undefined &&
    !options.data.roles.some((role) => role.id === form.roleId);

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
          const ref = parseMessageLink(link);
          setLinkError(
            ref ? null : "Вставте посилання на повідомлення з Discord.",
          );
          if (ref) load.mutate(ref);
        }}
      >
        <label className="admin-discord-form-wide">
          <span>Редагувати опубліковане повідомлення бота</span>
          <input
            autoComplete="off"
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://discord.com/channels/…"
            required
            value={link}
          />
        </label>
        <button
          className="admin-button"
          disabled={load.isPending}
          type="submit"
        >
          {load.isPending ? "Завантаження…" : "Відкрити для редагування"}
        </button>
      </form>
      {(linkError ?? load.error) && (
        <p className="admin-action-error" role="alert">
          {linkError ?? load.error?.message}
        </p>
      )}

      {editing && (
        <p className="admin-compact-state" role="status">
          Редагування опублікованого повідомлення.{" "}
          <button className="admin-button" onClick={stopEditing} type="button">
            Нове повідомлення
          </button>
        </p>
      )}

      <form
        className="admin-discord-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(form.roleId ? form : { ...form, buttonLabel: "" });
        }}
      >
        <label>
          <span>Канал</span>
          <select
            // Повідомлення не можна перенести в інший канал.
            disabled={!channelGroups || editing !== null}
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
            {unknownRole && (
              <option value={form.roleId}>
                Поточна роль (бот більше не може її видавати)
              </option>
            )}
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
          disabled={save.isPending}
          type="submit"
        >
          {editing
            ? save.isPending
              ? "Зберігаємо…"
              : "Зберегти зміни"
            : save.isPending
              ? "Публікуємо…"
              : "Опублікувати"}
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
      {save.error && (
        <p className="admin-action-error" role="alert">
          {save.error.message}
        </p>
      )}
      {saved && (
        <p className="admin-compact-state" role="status">
          {editing ? "Зміни збережено." : "Опубліковано."}
          {saved.roleName && ` Кнопка видає роль «${saved.roleName}».`}{" "}
          {!editing && (
            <button
              className="admin-button"
              disabled={load.isPending}
              onClick={() =>
                load.mutate({
                  channelId: saved.channelId,
                  messageId: saved.messageId,
                })
              }
              type="button"
            >
              Редагувати
            </button>
          )}
        </p>
      )}
      <p className="admin-discord-hint">
        У списку ролей лише ті, які бот може видати: без адмінських прав і нижчі
        за роль бота. Редагувати можна лише повідомлення, які написав бот.
      </p>
    </section>
  );
}
