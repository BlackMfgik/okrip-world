"use client";
import { useEffect, useRef, useState } from "react";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { DiscordLoginButton } from "@/features/auth/components/DiscordLoginButton";
import { useCurrentApplication } from "../hooks/useCurrentApplication";
import { ApplicationPanel } from "./ApplicationPanel";

function applicationActionLabel(
  data: ReturnType<typeof useCurrentApplication>["data"],
) {
  if (data?.access === "banned") return "🚫 Доступ заблоковано";
  if (data?.access === "revoked") return "⚠️ Доступ відкликано";
  if (data?.access === "active") return "✅ Заявку схвалено";
  if (data?.application?.status === "pending")
    return "⏳ Заявка на розгляді";
  if (data?.application?.status === "rejected")
    return "❌ Заявку відхилено";
  if (data?.application?.status === "cancelled")
    return "↩️ Заявку скасовано";
  if (data?.application?.status === "approved") return "✅ Заявку схвалено";
  return "Подати заявку";
}

export function ServerApplicationAction() {
  const session = useCurrentSession();
  const application = useCurrentApplication(!!session.data?.user);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const hasApplication = !!(application.data?.application || application.data?.access);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const currentDialog = dialog.current;
    currentDialog?.showModal();
    return () => {
      currentDialog?.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (session.data && !session.data.user) setOpen(false);
  }, [session.data]);
  return (
    <div className="server-application">
      {!hasApplication && (
        <p className="server-application-hint">
          Вхід на сервер — після схвалення заявки.
        </p>
      )}
      {session.isPending ? <p role="status">Перевіряємо вхід…</p> : session.error ? (
        <div role="alert"><p>{session.error.message}</p><button className="btn" onClick={() => void session.refetch()}>Спробувати ще раз</button></div>
      ) : !session.data?.user ? <DiscordLoginButton /> : (
        <>
          <p className="server-account">Discord · {session.data.user.displayName ?? session.data.user.username}</p>
          <button className="btn btn-primary" onClick={() => { setOpen(true); void application.refetch(); }} disabled={application.isPending}>
            {application.isPending ? "Перевіряємо заявку…" : application.error ? "Повторити перевірку заявки" : applicationActionLabel(application.data)}
          </button>
        </>
      )}
      {open && <dialog ref={dialog} className="application-dialog" aria-labelledby="application-dialog-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false); } }}>
        <header className="application-dialog-header">
          <div><p className="application-eyebrow">OKRIP WORLD · ВАНІЛА</p><h2 id="application-dialog-title">{hasApplication ? "Моя заявка" : "Заявка на сервер"}</h2></div>
        </header>
        <ApplicationPanel />
      </dialog>}
    </div>
  );
}

