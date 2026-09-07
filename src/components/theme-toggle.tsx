"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme-store";

export function ThemeToggle() {
  const hydrate = useThemeStore((s) => s.hydrate);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="theme-toggle" id="theme-toggle">
      <button
        type="button"
        className="theme-toggle-btn"
        title="Переключити тему"
        onClick={toggleTheme}
      />
    </div>
  );
}
