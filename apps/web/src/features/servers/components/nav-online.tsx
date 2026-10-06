"use client";

import { useTotalOnline } from "@/features/servers/hooks/use-total-online";

export function NavOnline() {
  const { data } = useTotalOnline();
  return (
    <span className="nav-online" id="nav-total-online">
      Онлайн {data ?? "—"}
    </span>
  );
}
