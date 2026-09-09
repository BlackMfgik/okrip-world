"use client";

import { useQuery } from "@tanstack/react-query";
import { SERVERS } from "@/lib/servers";

interface McStatusResponse {
  online: boolean;
  players?: { online?: number };
}

async function fetchStatus(ip: string): Promise<McStatusResponse> {
  const res = await fetch(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(ip)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useTotalOnline() {
  return useQuery({
    queryKey: ["total-online", SERVERS.map((s) => s.ip)],
    queryFn: async () => {
      const results = await Promise.allSettled(
        SERVERS.map((s) => fetchStatus(s.ip)),
      );
      return results.reduce((total, result) => {
        if (result.status === "fulfilled" && result.value.online) {
          return total + (result.value.players?.online ?? 0);
        }
        return total;
      }, 0);
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
