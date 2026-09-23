"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { queryKeys } from "@/lib/query-keys";

export function AccountMenu() {
  const session = useCurrentSession();
  const queryClient = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const user = session.data?.user;
  if (!user) return null;
  const name = user.displayName ?? user.username;

  return (
    <div className="account-menu" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Відкрити меню акаунта"
        className="account-menu-trigger"
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        type="button"
      >
        {user.avatarUrl ? (
          <Image
            alt={`Аватар ${name}`}
            height={36}
            src={user.avatarUrl}
            unoptimized
            width={36}
          />
        ) : (
          <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div
          aria-label="Особистий кабінет"
          className="account-menu-popover"
          role="dialog"
        >
          <p className="account-menu-eyebrow">Особистий кабінет</p>
          <div className="account-menu-profile">
            <div className="account-menu-profile-avatar" aria-hidden="true">
              {user.avatarUrl ? (
                <Image
                  alt=""
                  height={48}
                  src={user.avatarUrl}
                  unoptimized
                  width={48}
                />
              ) : (
                <span>{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="account-menu-identity">
              <strong>{name}</strong>
              <span>@{user.username}</span>
            </div>
          </div>
          {error && (
            <p className="account-menu-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="account-menu-logout"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              setError("");
              try {
                const response = await fetch("/v1/auth/logout", {
                  method: "POST",
                });
                if (!response.ok) throw new Error();
                queryClient.setQueryData(queryKeys.session, { user: null });
                queryClient.removeQueries({ queryKey: queryKeys.application });
                queryClient.removeQueries({
                  queryKey: queryKeys.adminApplicationsRoot,
                });
                setOpen(false);
              } catch {
                setError("Не вдалося вийти. Спробуйте ще раз.");
              } finally {
                setLoggingOut(false);
              }
            }}
            type="button"
          >
            {loggingOut ? "Виходимо…" : "Вийти з акаунта"}
          </button>
        </div>
      )}
    </div>
  );
}
