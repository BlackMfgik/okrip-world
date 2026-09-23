"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

function secondsUntil(until: string) {
  return Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 1000));
}

export function formatCooldown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
  return hours ? hours.toString().padStart(2, "0") + ":" + clock : clock;
}

export function ApplicationCooldown({ until }: { until: string }) {
  const queryClient = useQueryClient();
  const [remaining, setRemaining] = useState(() => secondsUntil(until));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let expired = false;
    const update = () => {
      const seconds = secondsUntil(until);
      setRemaining(seconds);
      if (seconds === 0 && !expired) {
        expired = true;
        if (timer) clearInterval(timer);
        void queryClient.invalidateQueries({ queryKey: queryKeys.application });
      }
    };

    update();
    if (!expired) timer = setInterval(update, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [queryClient, until]);

  if (remaining === 0) return null;

  return (
    <section className="application-cooldown" aria-live="polite">
      <span>Наступна заявка</span>
      <strong>{formatCooldown(remaining)}</strong>
      <p>Повторну заявку можна буде подати не раніше завершення відліку.</p>
    </section>
  );
}
