import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LoginErrorDialog } from "./LoginErrorDialog";
vi.stubGlobal("React", React);
afterEach(() => { cleanup(); vi.useRealTimers(); });
test("error is non-blocking, has no buttons and disappears after eight seconds", () => {
  vi.useFakeTimers();
  render(<LoginErrorDialog />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  act(() => vi.advanceTimersByTime(7999));
  expect(screen.getByRole("alert")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("alert")).toBeNull();
});
