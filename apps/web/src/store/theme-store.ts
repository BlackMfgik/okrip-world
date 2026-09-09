import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

interface ThemeState {
  theme: Theme;
  hydrate: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light-theme", theme === "light");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",

  hydrate: () => {
    if (typeof window === "undefined") return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
    }
    const theme: Theme = saved === "light" ? "light" : "dark";
    set({ theme });
    applyThemeToDocument(theme);
  },

  setTheme: (theme) => {
    set({ theme });
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
    }
  },

  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },
}));
