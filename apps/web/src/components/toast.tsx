"use client";

import { useToastStore } from "@/store/toast-store";

export function Toast() {
  const message = useToastStore((s) => s.message);
  const visible = useToastStore((s) => s.visible);

  return (
    <div className={`toast${visible ? " show" : ""}`} id="toast">
      {message}
    </div>
  );
}
