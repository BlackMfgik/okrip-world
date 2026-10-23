"use client";

import { useQuery } from "@tanstack/react-query";
import { SERVERS } from "@/features/servers/config";

interface McStatusResponse {
  online: boolean;
  players?: { online?: number };
}

async function fetchStatus(
  host: string,
  port: number,
): Promise<McStatusResponse> {
  const res = await fetch(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${port}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useTotalOnline() {
  const endpoints = [
    ...new Map(
      SERVERS.map((server) => {
        const host = server.ip.trim();
        return [
          `${host.toLowerCase()}:${server.port}`,
          { host, port: server.port },
        ];
      }),
    ).values(),
  ];

  return useQuery({
    queryKey: [
      "total-online",
      endpoints.map(({ host, port }) => `${host.toLowerCase()}:${port}`),
    ],
    queryFn: async () => {
      const results = await Promise.allSettled(
        endpoints.map(({ host, port }) => fetchStatus(host, port)),
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
