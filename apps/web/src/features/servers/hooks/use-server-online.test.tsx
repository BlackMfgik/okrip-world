import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServerOnline } from "./use-server-online";

afterEach(() => vi.unstubAllGlobals());

function renderOnline(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient();
  const { result } = renderHook(() => useServerOnline("/dynmap-vanilla"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { result, fetchMock };
}

it("reads the player count of this server from its Dynmap", async () => {
  const { result, fetchMock } = renderOnline(
    Response.json({ currentcount: 12, players: [] }),
  );
  await waitFor(() => expect(result.current.data).toBe(12));
  expect(fetchMock).toHaveBeenCalledWith(
    "/dynmap-vanilla/up/world/world/0",
    expect.anything(),
  );
});

it("fails instead of showing a count when the map is unavailable", async () => {
  const { result } = renderOnline(new Response("down", { status: 502 }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

it("fails when the Dynmap response has no player count", async () => {
  const { result } = renderOnline(Response.json({ players: [] }));
  await waitFor(() => expect(result.current.isError).toBe(true));
});
