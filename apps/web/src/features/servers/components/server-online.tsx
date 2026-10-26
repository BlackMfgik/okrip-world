"use client";

import { useServerOnline } from "@/features/servers/hooks/use-server-online";

export function ServerOnline({ dynmapPath }: { dynmapPath: string }) {
  const { data } = useServerOnline(dynmapPath);
  return <div className="server-status">Онлайн {data ?? "—"}</div>;
}
