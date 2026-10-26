"use client";

import { useQuery } from "@tanstack/react-query";

// Сервери стоять за одним IP і портом, тож пінг адреси дає лише спільний онлайн.
// Онлайн окремого сервера беремо з його Dynmap через проксі сайту: оновлення
// світу містить currentcount — кількість гравців на цьому сервері.
const DYNMAP_WORLD = "world";

async function fetchServerOnline(dynmapPath: string): Promise<number> {
  const res = await fetch(`${dynmapPath}/up/world/${DYNMAP_WORLD}/0`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body: unknown = await res.json();
  const count =
    typeof body === "object" && body !== null && "currentcount" in body
      ? body.currentcount
      : undefined;
  if (typeof count !== "number") throw new Error("Немає currentcount");
  return count;
}

export function useServerOnline(dynmapPath: string) {
  return useQuery({
    queryKey: ["server-online", dynmapPath],
    queryFn: () => fetchServerOnline(dynmapPath),
    retry: false,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
