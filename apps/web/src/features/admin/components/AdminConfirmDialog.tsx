"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface AdminConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  eyebrow?: string;
  tone: "danger" | "hour" | "neutral" | "success";
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminConfirmDialog({
  title,
  description,
  confirmLabel,
  eyebrow = "КЕРУВАННЯ ДОСТУПОМ",
  tone,
  pending,
  onCancel,
  onConfirm,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, pending]);

  return createPortal(
    <div
      className="admin-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={"admin-confirm admin-confirm-" + tone}
        role="dialog"
      >
        <div className="admin-confirm-icon" aria-hidden="true">
          {tone === "success" ? "✓" : "!"}
        </div>
        <p className="application-eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        <div className="admin-confirm-actions">
          <button
            className="admin-button admin-button-ghost"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Скасувати
          </button>
          <button
            ref={confirmButton}
            className={"admin-button admin-button-" + tone}
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Застосовуємо…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
