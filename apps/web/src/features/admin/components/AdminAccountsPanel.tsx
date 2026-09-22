"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminAccountListSchema,
  adminAccountMutationResultSchema,
  type AdminAccountMutation,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { DiscordAvatar } from "./DiscordAvatar";

export function AdminAccountsPanel() {
  const queryClient = useQueryClient();
  const [discordId, setDiscordId] = useState("");
  const accounts = useQuery({
    queryKey: queryKeys.adminAccounts,
    queryFn: () => apiRequest("/admin/accounts", adminAccountListSchema),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.adminAccounts });
  const addAdmin = useMutation({
    mutationFn: (body: AdminAccountMutation) =>
      apiRequest("/admin/accounts/add", adminAccountMutationResultSchema, body),
    onSuccess: async () => {
      setDiscordId("");
      await refresh();
    },
  });
  const removeAdmin = useMutation({
    mutationFn: (body: AdminAccountMutation) =>
      apiRequest(
        "/admin/accounts/remove",
        adminAccountMutationResultSchema,
        body,
      ),
    onSuccess: refresh,
  });
  const mutationError = addAdmin.error ?? removeAdmin.error;

  return (
    <section className="admin-whitelist-section admin-accounts-section">
      <header className="admin-whitelist-header">
        <div>
          <strong>Адміністратори</strong>
          <span>{accounts.data?.count ?? "—"}</span>
        </div>
        <p>Додавати й видаляти адмінів можуть лише власники.</p>
      </header>

      <form
        className="admin-account-form"
        onSubmit={(event) => {
          event.preventDefault();
          addAdmin.mutate({ discordId });
        }}
      >
        <label>
          <span>Discord ID нового адміна</span>
          <input
            inputMode="numeric"
            maxLength={20}
            minLength={17}
            onChange={(event) =>
              setDiscordId(event.target.value.replace(/\D/g, ""))
            }
            pattern="\d{17,20}"
            placeholder="123456789012345678"
            required
            value={discordId}
          />
        </label>
        <button
          className="admin-button admin-button-success"
          disabled={addAdmin.isPending}
          type="submit"
        >
          {addAdmin.isPending ? "Додаємо…" : "Додати адміна"}
        </button>
      </form>

      {mutationError && (
        <p className="admin-action-error" role="alert">
          {mutationError.message}
        </p>
      )}
      {accounts.isPending && (
        <p className="admin-compact-state">Завантажуємо список адмінів…</p>
      )}
      {accounts.error && (
        <div className="admin-compact-state" role="alert">
          <p>{accounts.error.message}</p>
          <button
            className="admin-button admin-button-ghost"
            onClick={() => void accounts.refetch()}
            type="button"
          >
            Повторити
          </button>
        </div>
      )}

      <div className="admin-account-list">
        {accounts.data?.accounts.map((account) => {
          const name =
            account.discordDisplayName ??
            account.discordUsername ??
            account.discordId;
          return (
            <article className="admin-account-row" key={account.discordId}>
              <div className="admin-account-person">
                <DiscordAvatar name={name} url={account.discordAvatarUrl} />
                <div>
                  <strong>{name}</strong>
                  <small>
                    {account.discordUsername
                      ? `@${account.discordUsername}`
                      : "Ще не входив через Discord"}
                  </small>
                </div>
              </div>
              <code>{account.discordId}</code>
              {account.canManageAdmins ? (
                <span className="admin-owner-badge">Власник</span>
              ) : (
                <button
                  className="admin-remove-player"
                  disabled={removeAdmin.isPending}
                  onClick={() => {
                    if (window.confirm(`Видалити адміна ${name}?`))
                      removeAdmin.mutate({ discordId: account.discordId });
                  }}
                  type="button"
                >
                  Видалити
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
