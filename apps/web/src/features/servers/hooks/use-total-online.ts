"use client";

import { useQuery } from "@tanstack/react-query";
import { SERVERS } from "@/features/servers/config";

interface McStatusResponse {
  online: boolean;
  players?: { online?: number };
}

async function fetchStatus(host: string): Promise<McStatusResponse> {
  const url = new URL(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}`,
  );
  url.searchParams.set("query", "false");
  url.searchParams.set("timeout", "2");

  const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useTotalOnline() {
  const endpoints = [
    ...new Map(
      SERVERS.map((server) => {
        const host = server.ip.trim();
        return [host.toLowerCase(), host];
      }),
    ).values(),
  ];

  return useQuery({
    queryKey: [
      "total-online",
      endpoints.map((host) => host.toLowerCase()),
    ],
    retry: false,
    queryFn: async () => {
      const results = await Promise.allSettled(
        endpoints.map((host) => fetchStatus(host)),
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
