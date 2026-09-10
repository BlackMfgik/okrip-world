import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";
import { equalSecret, tokenHash } from "../shared/crypto.js";
export function rateLimitKey(env: Env, request: FastifyRequest) {
  const ip = String(request.headers["x-okrip-client-ip"] ?? "");
  const stamp = String(request.headers["x-okrip-proxy-time"] ?? "");
  const signature = String(request.headers["x-okrip-proxy-signature"] ?? "");
  if (
    isIP(ip) &&
    /^\d+$/.test(stamp) &&
    Math.abs(Date.now() - Number(stamp)) < 30000 &&
    equalSecret(signature, tokenHash(ip + ":" + stamp, env.WEB_PROXY_SECRET))
  )
    return "browser:" + ip;
  return "direct:" + request.ip;
}
