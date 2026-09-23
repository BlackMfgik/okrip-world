import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationCooldown } from "./ApplicationCooldown";

vi.stubGlobal("React", React);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("counts down and refreshes the application when the cooldown ends", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");

  render(
    <QueryClientProvider client={client}>
      <ApplicationCooldown until="2026-09-23T12:01:00.000Z" />
    </QueryClientProvider>,
  );

  expect(screen.getByText("01:00")).toBeTruthy();
  await act(async () => vi.advanceTimersByTime(1_000));
  expect(screen.getByText("00:59")).toBeTruthy();

  await act(async () => vi.advanceTimersByTime(59_000));
  expect(screen.queryByText("00:00")).toBeNull();
  expect(invalidate).toHaveBeenCalledOnce();
});
