"use client";

import { useEffect, useState } from "react";
import { SITE_SUPPORT_URL } from "@/lib/site";

const DISMISSED_KEY = "okrip-support-banner-dismissed";

/** Закріплений унизу блок донату. Закритий стан пам'ятає браузер відвідувача. */
export function SupportBanner() {
  // До гідратації не показуємо, щоб банер не блимав у тих, хто його закрив.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!SITE_SUPPORT_URL || !visible) return null;
  return (
    <aside className="support-banner" aria-labelledby="support-banner-title">
      <div className="support-banner-icon" aria-hidden="true">
        💛
      </div>
      <div className="support-banner-text">
        <h2 id="support-banner-title">Підтримай сервер</h2>
        <p>Хостинг оплачуємо самі, тож кожна гривня допомагає серверу жити.</p>
      </div>
      <a
        className="btn btn-primary support-banner-button"
        href={SITE_SUPPORT_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        На банку →
      </a>
      <button
        aria-label="Закрити"
        className="support-banner-close"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem(DISMISSED_KEY, "1");
          } catch {}
        }}
        type="button"
      >
        ×
      </button>
    </aside>
  );
}
