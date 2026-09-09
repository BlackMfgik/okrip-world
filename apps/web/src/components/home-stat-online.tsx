"use client";

import { useTotalOnline } from "@/hooks/use-total-online";

export function HomeStatOnline() {
  const { data } = useTotalOnline();
  return (
    <span className="stat-num" id="stat-total-online">
      {data ?? "—"}
    </span>
  );
}
