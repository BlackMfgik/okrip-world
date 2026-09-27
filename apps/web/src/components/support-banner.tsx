"use client";

import { useEffect, useState } from "react";
import { SITE_SUPPORT_URL } from "@/lib/site";

const DISMISSED_KEY = "okrip-support-banner-dismissed";

/**
 * Закріплений унизу блок донату. Закритий банер з'їжджає вниз, а з лівого краю виїжджає язичок;
 * натискання на язичок програє ту саму анімацію у зворотному порядку.
 * Згорнутий стан пам'ятає браузер відвідувача.
 */
export function SupportBanner() {
  // null — ще не прочитали localStorage: нічого не рендеримо, щоб банер не блимав.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  // Перший показ без анімації: згорнутий банер одразу на місці, а не виїжджає при завантаженні.
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  if (!SITE_SUPPORT_URL || collapsed === null) return null;

  const toggle = (next: boolean) => {
    setAnimated(true);
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(DISMISSED_KEY, "1");
      else localStorage.removeItem(DISMISSED_KEY);
    } catch {}
  };
  const state = [
    collapsed ? "is-collapsed" : "is-open",
    animated ? "is-animated" : "",
  ].join(" ");

  return (
    <>
      <aside
        aria-hidden={collapsed}
        aria-labelledby="support-banner-title"
        className={"support-banner " + state}
        inert={collapsed}
      >
        <div className="support-banner-icon" aria-hidden="true">
          💛
        </div>
        <div className="support-banner-text">
          <h2 id="support-banner-title">Підтримай сервер</h2>
          <p>
            Хостинг оплачуємо самі, тож кожна гривня допомагає серверу жити.
          </p>
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
          aria-label="Згорнути"
          className="support-banner-close"
          onClick={() => toggle(true)}
          type="button"
        >
          ×
        </button>
      </aside>
      <button
        aria-label="Підтримати сервер"
        className={"support-tab " + state}
        inert={!collapsed}
        onClick={() => toggle(false)}
        tabIndex={collapsed ? 0 : -1}
        type="button"
      >
        <span aria-hidden="true">💛</span>
      </button>
    </>
  );
}
