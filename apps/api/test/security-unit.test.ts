import { expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { rateLimitKey } from "../src/plugins/rate-limit.js";
import { tokenHash } from "../src/shared/crypto.js";
import { env } from "./helpers.js";
it("accepts only fresh authenticated proxy IP assertions", () => {
  const stamp = String(Date.now()),
    ip = "203.0.113.1";
  const request = {
    ip: "127.0.0.1",
    headers: {
      "x-okrip-client-ip": ip,
      "x-okrip-proxy-time": stamp,
      "x-okrip-proxy-signature": tokenHash(
        ip + ":" + stamp,
        env.WEB_PROXY_SECRET,
      ),
    },
  } as unknown as FastifyRequest;
  expect(rateLimitKey(env, request)).toBe("browser:" + ip);
  request.headers["x-okrip-client-ip"] = "203.0.113.2";
  expect(rateLimitKey(env, request)).toBe("direct:127.0.0.1");
  request.headers["x-okrip-client-ip"] = ip;
  request.headers["x-okrip-proxy-time"] = "0";
  expect(rateLimitKey(env, request)).toBe("direct:127.0.0.1");
});
it("keys direct requests by Railway X-Real-IP only on Railway", () => {
  const request = {
    ip: "10.0.0.5",
    headers: { "x-real-ip": "198.51.100.7" },
  } as unknown as FastifyRequest;
  const railway = { ...env, RAILWAY_ENVIRONMENT_ID: "env-id" };
  expect(rateLimitKey(railway, request)).toBe("direct:198.51.100.7");
  expect(rateLimitKey(env, request)).toBe("direct:10.0.0.5");
  request.headers["x-real-ip"] = "not-an-ip";
  expect(rateLimitKey(railway, request)).toBe("direct:10.0.0.5");
  request.headers["x-real-ip"] = undefined;
  request.headers["x-forwarded-for"] = "198.51.100.8";
  expect(rateLimitKey(railway, request)).toBe("direct:10.0.0.5");

  const stamp = String(Date.now()),
    ip = "203.0.113.1";
  Object.assign(request.headers, {
    "x-real-ip": "198.51.100.7",
    "x-okrip-client-ip": ip,
    "x-okrip-proxy-time": stamp,
    "x-okrip-proxy-signature": tokenHash(
      ip + ":" + stamp,
      env.WEB_PROXY_SECRET,
    ),
  });
  expect(rateLimitKey(railway, request)).toBe("browser:" + ip);
});
