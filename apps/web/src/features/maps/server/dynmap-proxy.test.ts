// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { dynmapProxy } from "./dynmap-proxy";

const upstream = vi.fn<(url: URL) => Promise<Response>>(
  async () => new Response("tile", { status: 200 }),
);

beforeEach(() => {
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

it("serves the map to everyone without a token", async () => {
  const response = await get(
    dynmapProxy("DYNMAP_ORIGIN"),
    "tiles/world/flat/0_0.png",
  );
  expect(response.status).toBe(200);
  expect(String(upstream.mock.calls[0]![0])).toBe(
    "http://dynmap.internal:8123/tiles/world/flat/0_0.png",
  );
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=600");
  // Документ Dynmap ізольовано sandbox і вбудовується лише в сторінки сайту.
  expect(response.headers.get("Content-Security-Policy")).toBe(
    "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; frame-ancestors 'self'",
  );
});
