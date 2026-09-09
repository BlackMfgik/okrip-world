"use client";

import { useTotalOnline } from "@/hooks/use-total-online";

export function NavOnline() {
  const { data } = useTotalOnline();
  return (
    <span className="nav-online" id="nav-total-online">
      ОНЛАЙН {data ?? "—"}
    </span>
  );
}
