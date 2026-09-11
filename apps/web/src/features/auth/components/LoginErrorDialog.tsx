"use client";

import { useEffect, useState } from "react";

export function LoginErrorDialog() {
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
        <h2>Не вдалося завершити вхід</h2>
        <p className="login-toast-description">Спробуйте увійти через Discord ще раз.</p>
      </div>
      <div className="login-toast-progress" aria-hidden="true" />
    </aside>
  );
}
