import { headers } from "next/headers";
import { sessionSchema } from "@okrip/contracts";
import { proxyHeaders } from "@/lib/proxy-request";

/** Серверна перевірка: чи поточний запит належить адміну сайту (за сесією в API). */
export async function isAdminSession() {
  const base = process.env.API_INTERNAL_URL;
  const secret = process.env.WEB_PROXY_SECRET;
  if (!base || !secret) return false;
  try {
    const request = new Request("http://internal", { headers: await headers() });
    const response = await fetch(new URL("/v1/me", base), {
      headers: proxyHeaders(request, secret),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    return sessionSchema.parse(await response.json()).user?.isAdmin ?? false;
  } catch {
    return false;
  }
}
