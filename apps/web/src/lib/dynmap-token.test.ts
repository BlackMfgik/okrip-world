import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDynmapToken, verifyDynmapToken } from "./dynmap-token";

beforeEach(() => {
  vi.stubEnv("WEB_PROXY_SECRET", "p".repeat(32));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("accepts only its own unexpired tokens", () => {
  const token = createDynmapToken()!;
  expect(verifyDynmapToken(token)).toBe(true);

  const [expires, signature] = token.split(".");
  expect(verifyDynmapToken(`${Number(expires) + 1}.${signature}`)).toBe(false);
  expect(verifyDynmapToken(expires + ".")).toBe(false);
  expect(verifyDynmapToken("index.html")).toBe(false);

  vi.stubEnv("WEB_PROXY_SECRET", "q".repeat(32));
  expect(verifyDynmapToken(token)).toBe(false);
});

it("expires tokens and refuses to work without a secret", () => {
  vi.useFakeTimers();
  const token = createDynmapToken()!;
  vi.advanceTimersByTime(13 * 60 * 60 * 1000);
  expect(verifyDynmapToken(token)).toBe(false);

  vi.stubEnv("WEB_PROXY_SECRET", "");
  expect(createDynmapToken()).toBeNull();
});
