"use client";

import { useToastStore } from "@/store/toast-store";

interface IpRowProps {
  label: string;
  value: string;
  copyText?: string;
}

export function IpRow({ label, value, copyText }: IpRowProps) {
  const show = useToastStore((s) => s.show);
  const text = copyText ?? value;

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      show(`Скопійовано: ${text}`);
    } catch {
      show("Помилка копіювання");
    }
  };

  return (
    <div className="ip-row" onClick={handleClick}>
      <div className="ip-info">
        <div className="ip-label">{label}</div>
        <div className="ip-value">{value}</div>
      </div>
      <span className="copy-btn">Копіювати</span>
    </div>
  );
}
