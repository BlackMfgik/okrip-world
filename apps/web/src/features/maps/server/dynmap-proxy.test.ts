// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { dynmapProxy } from "./dynmap-proxy";
import { createDynmapToken } from "./dynmap-token";

const upstream = vi.fn<(url: URL) => Promise<Response>>(
  async () => new Response("tile", { status: 200 }),
);

beforeEach(() => {
  vi.stubEnv("WEB_PROXY_SECRET", "p".repeat(32));
  vi.stubEnv("DYNMAP_ORIGIN", "http://dynmap.internal:8123");
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  upstream.mockClear();
});

const get = (handlers: ReturnType<typeof dynmapProxy>, path: string) =>
  handlers.GET(new NextRequest("http://localhost:3000/dynmap/" + path), {
    params: Promise.resolve({ path: path.split("/") }),
  });

it("serves an admin-only map only under a valid token", async () => {
  const handlers = dynmapProxy("DYNMAP_ORIGIN", { adminOnly: true });

  expect((await get(handlers, "tiles/world/flat/0_0.png")).status).toBe(404);
  expect((await get(handlers, "bad.token/tiles/0_0.png")).status).toBe(404);
  expect((await get(handlers, createDynmapToken()!)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();

  const response = await get(
    handlers,
    createDynmapToken() + "/tiles/world/flat/0_0.png",
  );
  expect(response.status).toBe(200);
  expect(String(upstream.mock.calls[0]![0])).toBe(
    "http://dynmap.internal:8123/tiles/world/flat/0_0.png",
  );
  expect(response.headers.get("Cache-Control")).toBe("private, max-age=600");
});

it("keeps a public map open without a token", async () => {
  const response = await get(
    dynmapProxy("DYNMAP_ORIGIN"),
    "tiles/world/flat/0_0.png",
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=600");
});
