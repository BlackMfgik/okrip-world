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
