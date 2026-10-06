"use client";
import { useState } from "react";
import Link from "next/link";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { AdminAccountsPanel } from "./AdminAccountsPanel";
import { AdminApplicationsPanel } from "./AdminApplicationsPanel";
import { WhitelistPanel } from "./WhitelistPanel";
import { DiscordRoleMessagePanel } from "./DiscordRoleMessagePanel";

export function AdminPanel() {
  const session = useCurrentSession();
  const [section, setSection] = useState<
    "applications" | "whitelist" | "accounts" | "discord"
  >("applications");
  if (session.isPending)
    return <p className="admin-state">Перевіряємо права доступу…</p>;
  if (session.error)
    return (
      <div className="admin-state" role="alert">
        <p>{session.error.message}</p>
        <button className="btn" onClick={() => void session.refetch()}>
          Повторити
        </button>
      </div>
    );
  if (!session.data?.user?.isAdmin)
    return (
      <section className="admin-state admin-denied">
        <p className="application-eyebrow">OKRIP WORLD</p>
        <h1>Сторінка недоступна</h1>
        <p>Цей розділ відкритий лише адміністраторам.</p>
        <Link href="/" className="btn btn-primary">
          На головну
        </Link>
      </section>
    );

  const activeSection =
    (section === "accounts" && !session.data.user.canManageAdmins) ||
    (section === "discord" && !session.data.user.isSuperAdmin)
      ? "applications"
      : section;
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <nav className="admin-sections" aria-label="Розділи адмін-панелі">
          <button
            className={
              activeSection === "applications" ? "is-active" : undefined
            }
            onClick={() => setSection("applications")}
            type="button"
          >
            Заявки
          </button>
          <button
            className={activeSection === "whitelist" ? "is-active" : undefined}
            onClick={() => setSection("whitelist")}
            type="button"
          >
            Вайтліст
          </button>
          {session.data.user.canManageAdmins && (
            <button
              className={activeSection === "accounts" ? "is-active" : undefined}
              onClick={() => setSection("accounts")}
              type="button"
            >
              Адміни
            </button>
          )}
          {session.data.user.isSuperAdmin && (
            <button
              className={activeSection === "discord" ? "is-active" : undefined}
              onClick={() => setSection("discord")}
              type="button"
            >
              Discord
            </button>
          )}
        </nav>
        <div className="admin-identity">
          <span>Адміністратор</span>
          <strong>
            {session.data.user.displayName ?? session.data.user.username}
          </strong>
        </div>
      </header>

      <AdminApplicationsPanel active={activeSection === "applications"} />
      {activeSection === "whitelist" && <WhitelistPanel />}
      {activeSection === "accounts" && <AdminAccountsPanel />}
      {activeSection === "discord" && <DiscordRoleMessagePanel />}
    </div>
  );
}
