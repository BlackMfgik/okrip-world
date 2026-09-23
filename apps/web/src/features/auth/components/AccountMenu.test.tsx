import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountMenu } from "./AccountMenu";

vi.stubGlobal("React", React);
vi.mock("@/features/auth/hooks/useCurrentSession", () => ({
  useCurrentSession: () => ({
    data: {
      user: {
        username: "discord-user",
        displayName: "Discord User",
        avatarUrl: "https://cdn.discordapp.com/avatars/111/avatar.webp?size=64",
        isAdmin: false,
        canManageAdmins: false,
      },
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("opens the Discord account menu and logs out", async () => {
  const request = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", request);
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <AccountMenu />
    </QueryClientProvider>,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Відкрити меню акаунта" }),
  );
  expect(screen.getByText("Особистий кабінет")).toBeTruthy();
  expect(screen.getByText("Discord User")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Вийти з акаунта" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("/v1/auth/logout", { method: "POST" }),
  );
  expect(screen.queryByText("Особистий кабінет")).toBeNull();
});
