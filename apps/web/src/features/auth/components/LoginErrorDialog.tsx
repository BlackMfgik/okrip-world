"use client";

import { useEffect, useState } from "react";
import { SITE_DISCORD_URL } from "@/lib/site";

const MESSAGES: Record<string, { title: string; description: string }> = {
  guild_required: {
    title: "Ви не на Discord-сервері",
    description: "Спочатку приєднайтеся до Discord-сервера Okrip World, а потім увійдіть ще раз.",
  },
  guild_screening: {
    title: "Завершіть перевірку в Discord",
    description: "Прийміть правила Discord-сервера Okrip World, а потім увійдіть ще раз.",
  },
};
const DEFAULT_MESSAGE = {
  title: "Не вдалося завершити вхід",
  description: "Спробуйте увійти через Discord ще раз.",
};

export function LoginErrorDialog({ reason }: { reason?: string }) {
  const message = (reason && MESSAGES[reason]) || DEFAULT_MESSAGE;
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, 8000);
    const removeTimer = window.setTimeout(() => {
      setVisible(false);
      if (window.location.pathname === "/auth/callback") {
        window.history.replaceState(null, "", "/servers");
      }
    }, 8450);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;
  return (
    <aside
      className={`login-error-toast${exiting ? " is-exiting" : ""}`}
      role="alert"
      aria-atomic="true"
    >
      <div className="login-toast-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="16" cy="16" r="12" /><path d="M16 9v8m0 5h.01" />
        </svg>
      </div>
      <div>
        <p className="application-eyebrow">DISCORD · ВХІД</p>
        <h2>{message.title}</h2>
        <p className="login-toast-description">{message.description}</p>
        {message !== DEFAULT_MESSAGE && (
          <a className="login-toast-link" href={SITE_DISCORD_URL} rel="noopener noreferrer" target="_blank">
            Відкрити Discord →
          </a>
        )}
      </div>
      <div className="login-toast-progress" aria-hidden="true" />
    </aside>
  );
}
