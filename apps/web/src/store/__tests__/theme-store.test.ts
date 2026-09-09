import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/store/theme-store";

function resetDom() {
  document.documentElement.classList.remove("light-theme");
  localStorage.clear();
}

describe("theme-store", () => {
  beforeEach(() => {
    resetDom();
    useThemeStore.setState({ theme: "dark" });
  });

  it("defaults to dark theme", () => {
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("light-theme")).toBe(
      false,
    );
  });

  it("toggleTheme switches to light and persists a plain string", () => {
    useThemeStore.getState().toggleTheme();

    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("light-theme")).toBe(
      true,
    );
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("toggling twice returns to dark", () => {
    const { toggleTheme } = useThemeStore.getState();
    toggleTheme();
    toggleTheme();

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("hydrate reads an existing 'light' value from localStorage", () => {
    localStorage.setItem("theme", "light");
    useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("light-theme")).toBe(
      true,
    );
  });

  it("hydrate falls back to dark on garbage localStorage values", () => {
    localStorage.setItem("theme", "sepia");
    useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe("dark");
  });
});
