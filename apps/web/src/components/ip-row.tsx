"use client";

import { useToastStore } from "@/store/toast-store";

interface IpRowProps {
  label: string;
  value: string;
  copyText?: string;
  /** Значення ще немає (сервер «Soon»): рядок без копіювання. */
  placeholder?: boolean;
}

export function IpRow({ label, value, copyText, placeholder }: IpRowProps) {
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

  if (placeholder)
    return (
      <div className="ip-row ip-row-placeholder">
        <div className="ip-info">
          <div className="ip-label">{label}</div>
          <div className="ip-value">{value}</div>
        </div>
      </div>
    );

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
