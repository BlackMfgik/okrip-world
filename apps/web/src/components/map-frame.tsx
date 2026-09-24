"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";

interface MapFrameProps {
  title: string;
  /** Базовий шлях проксі мапи із завершальним слешем, напр. "/dynmap/". */
  base?: string;
}

type MapState = "checking" | "loading" | "ready" | "error";

export function MapFrame({ title, base }: MapFrameProps) {
  const [state, setState] = useState<MapState>(base ? "checking" : "error");
  // Скін мапи (public/dynmap-skin.css) підлаштовується під тему сайту.
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    if (!base) return;
    // iframe повідомляє onLoad навіть для сторінки помилки 502, тому спершу
    // перевіряємо, що Dynmap справді відповідає.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    fetch(base + "up/configuration", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => setState(response.ok ? "loading" : "error"))
      .catch(() => setState("error"))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [base]);

  useEffect(() => {
    if (state !== "loading") return;
    // onLoad iframe чекає на всі тайли, що може тривати довго. Мапа з'являється
    // поступово сама, тож заглушку прибираємо, щойно Dynmap встиг стартувати.
    const timer = setTimeout(() => setState("ready"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="maparea">
      {base && state !== "checking" && state !== "error" && (
        <iframe
          src={base + "index.html" + (theme === "light" ? "?theme=light" : "")}
          title={title}
          allowFullScreen
          onLoad={() => setState("ready")}
        />
      )}

      <div
        className={`map-placeholder${state === "checking" || state === "loading" ? "" : " hidden"}`}
        role="status"
      >
        <div className="pulse" />
        <span>Завантаження мапи…</span>
      </div>

      <div className={`map-error${state === "error" ? " visible" : ""}`}>
        МАПА НАРАЗІ НЕДОСТУПНА
      </div>
    </div>
  );
}
