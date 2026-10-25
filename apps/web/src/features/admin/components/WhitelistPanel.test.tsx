import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WhitelistPanel } from "./WhitelistPanel";

function player(
  index: number,
  minecraftUsername: string,
  discordUsername: string,
  addedAt: string,
) {
  return {
    accessId: `00000000-0000-4000-8000-00000000000${index}`,
    serverId: "modded",
    minecraftUsername,
    discordUsername,
    discordDisplayName: null,
    discordId: `1000000000000000${index}`,
    discordAvatarUrl: null,
    addedAt,
  };
}

const players = [
  player(1, "bravo", "second_user", "2026-10-02T10:00:00.000Z"),
  player(2, "Charlie", "third_user", "2026-10-03T10:00:00.000Z"),
  player(3, "alpha", "first_user", "2026-10-01T10:00:00.000Z"),
];
const request = vi.fn(async (input: RequestInfo | URL) => {
  const path = String(input);
  if (path.endsWith("/admin/whitelist"))
    return Response.json({ players, count: players.length });
  throw new Error("Unexpected request: " + path);
});
let client: QueryClient;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", request);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

async function renderedNames() {
  await screen.findByText("alpha");
  return Array.from(
    document.querySelectorAll(".admin-player-row .admin-player-main strong"),
    (node) => node.textContent,
  );
}

test("sorts the whitelist by date and by nickname", async () => {
  render(
    <QueryClientProvider client={client}>
      <WhitelistPanel />
    </QueryClientProvider>,
  );
  expect(await renderedNames()).toEqual(["Charlie", "bravo", "alpha"]);

  const sort = screen.getByLabelText("Сортування");
  fireEvent.change(sort, { target: { value: "oldest" } });
  expect(await renderedNames()).toEqual(["alpha", "bravo", "Charlie"]);
  fireEvent.change(sort, { target: { value: "name-asc" } });
  expect(await renderedNames()).toEqual(["alpha", "bravo", "Charlie"]);
  fireEvent.change(sort, { target: { value: "name-desc" } });
  expect(await renderedNames()).toEqual(["Charlie", "bravo", "alpha"]);
});

test("filters the whitelist by nickname, Discord and Discord ID", async () => {
  render(
    <QueryClientProvider client={client}>
      <WhitelistPanel />
    </QueryClientProvider>,
  );
  await screen.findByText("alpha");
  const search = screen.getByLabelText("Пошук у вайтлісті");

  fireEvent.change(search, { target: { value: "CHAR" } });
  expect(screen.getByText("Charlie")).toBeTruthy();
  expect(screen.queryByText("alpha")).toBeNull();

  fireEvent.change(search, { target: { value: "first_user" } });
  expect(screen.getByText("alpha")).toBeTruthy();
  expect(screen.queryByText("Charlie")).toBeNull();

  fireEvent.change(search, { target: { value: "10000000000000002" } });
  expect(screen.getByText("Charlie")).toBeTruthy();

  fireEvent.change(search, { target: { value: "nobody" } });
  expect(
    screen.getByText("За запитом «nobody» нікого не знайдено."),
  ).toBeTruthy();
});
