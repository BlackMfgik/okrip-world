"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminWhitelistMutationResultSchema,
  adminWhitelistSchema,
  type AdminWhitelistAdd,
  type AdminWhitelistRemove,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
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
  const mutationError = addPlayer.error ?? removePlayer.error;

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
              <div>
                <strong>{player.minecraftUsername}</strong>
                <small>Додано {formatDate(player.addedAt)}</small>
              </div>
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
            <button
              className="admin-remove-player"
              disabled={removePlayer.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Видалити ${player.minecraftUsername} з вайтліста?`,
                  )
                )
                  removePlayer.mutate({ accessId: player.accessId });
              }}
              type="button"
            >
              Видалити
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
