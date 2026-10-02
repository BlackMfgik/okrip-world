import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LoginErrorDialog } from "./LoginErrorDialog";
vi.stubGlobal("React", React);
afterEach(() => { cleanup(); vi.useRealTimers(); });
test("error is non-blocking and slides out before it disappears", () => {
  vi.useFakeTimers();
  render(<LoginErrorDialog />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  act(() => vi.advanceTimersByTime(7999));
  expect(screen.getByRole("alert")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("alert").classList.contains("is-exiting")).toBe(true);
  act(() => vi.advanceTimersByTime(449));
  expect(screen.getByRole("alert")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("alert")).toBeNull();
});
test("explains a missing Discord guild membership with a link", () => {
  render(<LoginErrorDialog reason="guild_required" />);
  expect(screen.getByText("Ви не на Discord-сервері")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toContain("discord.gg");
});
test("falls back to the generic message for unknown reasons", () => {
  render(<LoginErrorDialog reason="login_failed" />);
  expect(screen.getByText("Не вдалося завершити вхід")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});
