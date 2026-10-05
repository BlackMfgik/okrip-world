import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountMenu } from "./AccountMenu";

vi.stubGlobal("React", React);
vi.mock("@/features/auth/hooks/useCurrentSession", () => ({
  useCurrentSession: () => ({ data: { user: null } }),
}));

afterEach(() => cleanup());

test("shows an avatar placeholder with Discord login to guests", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountMenu />
    </QueryClientProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Увійти в акаунт" }));
  expect(screen.getByText("Ви не увійшли")).toBeTruthy();
  const login = screen.getByRole("button", {
    name: "Авторизуватись через Discord",
  });
  expect(login.closest("form")?.getAttribute("action")).toBe(
    "/v1/auth/discord/start",
  );
});
