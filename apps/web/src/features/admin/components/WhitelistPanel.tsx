"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminWhitelistMutationResultSchema,
  adminWhitelistSchema,
  type AdminWhitelistAdd,
  type AdminWhitelistRemove,
  type AdminWhitelistRename,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { DiscordAvatar } from "./DiscordAvatar";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WhitelistPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<{
    accessId: string;
    minecraftUsername: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<AdminWhitelistRename | null>(null);
  const [form, setForm] = useState<AdminWhitelistAdd>({
    minecraftUsername: "",
    discordUsername: "",
    discordId: "",
  });

  const whitelist = useQuery({
    queryKey: queryKeys.adminWhitelist,
    queryFn: () => apiRequest("/admin/whitelist", adminWhitelistSchema),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.adminWhitelist });
  const addPlayer = useMutation({
    mutationFn: (body: AdminWhitelistAdd) =>
      apiRequest(
        "/admin/whitelist/add",
        adminWhitelistMutationResultSchema,
        body,
      ),
    onSuccess: async () => {
      setForm({ minecraftUsername: "", discordUsername: "", discordId: "" });
      setShowAdd(false);
      await refresh();
    },
  });
  const removePlayer = useMutation({
    mutationFn: (body: AdminWhitelistRemove) =>
      apiRequest(
        "/admin/whitelist/remove",
        adminWhitelistMutationResultSchema,
        body,
      ),
    onSuccess: refresh,
  });
  const renamePlayer = useMutation({
    mutationFn: (body: AdminWhitelistRename) =>
      apiRequest(
        "/admin/whitelist/rename",
        adminWhitelistMutationResultSchema,
        body,
      ),
    onSuccess: async () => {
      setRenaming(null);
      await refresh();
    },
  });
  const mutationError =
    addPlayer.error ?? removePlayer.error ?? renamePlayer.error;

  return (
    <section className="admin-whitelist-section">
      <header className="admin-whitelist-header">
        <div>
          <strong>Гравці у вайтлісті</strong>
          <span>{whitelist.data?.count ?? "—"}</span>
        </div>
        <button
          className="admin-button admin-button-ghost admin-add-player-button"
          onClick={() => setShowAdd((value) => !value)}
          type="button"
        >
          {showAdd ? "Закрити" : "+ Додати гравця"}
        </button>
      </header>

      {showAdd && (
        <form
          className="admin-add-player-form"
          onSubmit={(event) => {
            event.preventDefault();
            addPlayer.mutate(form);
          }}
        >
          <label>
            <span>Minecraft-нік</span>
            <input
              autoComplete="off"
              maxLength={16}
              minLength={3}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  minecraftUsername: event.target.value,
                }))
              }
              pattern="[A-Za-z0-9_]{3,16}"
              placeholder="Player_Name"
              required
              value={form.minecraftUsername}
            />
          </label>
          <label>
            <span>Discord</span>
            <input
              autoComplete="off"
              maxLength={64}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  discordUsername: event.target.value,
                }))
              }
              placeholder="username"
              required
              value={form.discordUsername}
            />
          </label>
          <label>
            <span>Discord ID</span>
            <input
              autoComplete="off"
              inputMode="numeric"
              maxLength={20}
              minLength={17}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  discordId: event.target.value.replace(/\D/g, ""),
                }))
              }
              pattern="\d{17,20}"
              placeholder="123456789012345678"
              required
              value={form.discordId}
            />
          </label>
          <button
            className="admin-button admin-button-success"
            disabled={addPlayer.isPending}
            type="submit"
          >
            {addPlayer.isPending ? "Додаємо…" : "Додати у вайтліст"}
          </button>
        </form>
      )}

      {mutationError && (
        <p className="admin-action-error" role="alert">
          {mutationError.message}
        </p>
      )}
      {whitelist.isPending && (
        <p className="admin-compact-state" role="status">
          Завантажуємо вайтліст…
        </p>
      )}
      {whitelist.error && (
        <div className="admin-compact-state" role="alert">
          <p>{whitelist.error.message}</p>
          <button
            className="admin-button admin-button-ghost"
            onClick={() => void whitelist.refetch()}
          >
            Повторити
          </button>
        </div>
      )}
      {whitelist.data?.players.length === 0 && (
        <p className="admin-compact-state">Вайтліст поки порожній.</p>
      )}

      <div className="admin-player-list">
        {whitelist.data?.players.map((player) => (
          <article className="admin-player-row" key={player.accessId}>
            <div className="admin-player-main">
              <DiscordAvatar
                name={player.minecraftUsername}
                url={player.discordAvatarUrl}
              />
              {renaming?.accessId === player.accessId ? (
                <form
                  className="admin-rename-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    renamePlayer.mutate(renaming);
                  }}
                >
                  <input
                    aria-label={"Новий нік для " + player.minecraftUsername}
                    autoComplete="off"
                    autoFocus
                    disabled={renamePlayer.isPending}
                    maxLength={16}
                    minLength={3}
                    onChange={(event) =>
                      setRenaming({
                        accessId: player.accessId,
                        minecraftUsername: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    pattern="[A-Za-z0-9_]{3,16}"
                    required
                    value={renaming.minecraftUsername}
                  />
                  <button
                    className="admin-button admin-button-success"
                    disabled={renamePlayer.isPending}
                    type="submit"
                  >
                    {renamePlayer.isPending ? "…" : "Зберегти"}
                  </button>
                  <button
                    className="admin-button admin-button-ghost"
                    disabled={renamePlayer.isPending}
                    onClick={() => setRenaming(null)}
                    type="button"
                  >
                    Скасувати
                  </button>
                </form>
              ) : (
                <div>
                  <strong>{player.minecraftUsername}</strong>
                  <small>Додано {formatDate(player.addedAt)}</small>
                </div>
              )}
            </div>
            <div className="admin-player-discord">
              <span>Discord</span>
              <strong>
                {player.discordDisplayName ?? `@${player.discordUsername}`}
              </strong>
              {player.discordDisplayName && (
                <small>@{player.discordUsername}</small>
              )}
            </div>
            <div className="admin-player-id">
              <span>Discord ID</span>
              <code>{player.discordId}</code>
            </div>
            <div className="admin-player-actions">
              <button
                className="admin-button admin-button-neutral"
                disabled={renamePlayer.isPending}
                onClick={() => {
                  renamePlayer.reset();
                  setRenaming({
                    accessId: player.accessId,
                    minecraftUsername: player.minecraftUsername,
                  });
                }}
                type="button"
              >
                Змінити нік
              </button>
              <button
                className="admin-remove-player"
                disabled={removePlayer.isPending}
                onClick={() =>
                  setRemoving({
                    accessId: player.accessId,
                    minecraftUsername: player.minecraftUsername,
                  })
                }
                type="button"
              >
                Видалити
              </button>
            </div>
          </article>
        ))}
      </div>
      {removing && (
        <AdminConfirmDialog
          confirmLabel="Видалити"
          description={
            removing.minecraftUsername +
            " втратить доступ до сервера. Повернути гравця можна буде лише вручну."
          }
          eyebrow="ВАЙТЛІСТ"
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            removePlayer.mutate(
              { accessId: removing.accessId },
              { onSettled: () => setRemoving(null) },
            )
          }
          pending={removePlayer.isPending}
          title={"Видалити " + removing.minecraftUsername + " з вайтліста?"}
          tone="danger"
        />
      )}
    </section>
  );
}
