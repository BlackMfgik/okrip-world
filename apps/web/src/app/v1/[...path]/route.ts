import { proxyHeaders, boundedBody } from "@/lib/proxy-request";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = new Set([
  "auth/discord/start",
  "auth/discord/callback",
  "auth/logout",
  "me",
  "applications",
  "applications/current",
  "admin/applications",
  "admin/applications/decision",
  "admin/whitelist",
  "admin/whitelist/add",
  "admin/whitelist/remove",
]);
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join("/");
  if (!allowed.has(endpoint))
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  const base = process.env.API_INTERNAL_URL;
  if (!base || !process.env.WEB_PROXY_SECRET)
    return NextResponse.json(
      { message: "Авторизацію ще не налаштовано." },
      { status: 503 },
    );
  const target = new URL("/v1/" + endpoint, base);
  target.search = request.nextUrl.search;
  const headers = proxyHeaders(request, process.env.WEB_PROXY_SECRET);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await boundedBody(request) : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
    });
    for (const name of ["content-type", "location", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      response.headers.append("set-cookie", cookie);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof RangeError)
      return NextResponse.json(
        { message: "Запит завеликий." },
        { status: 413 },
      );
    return NextResponse.json(
      { message: "Сервіс тимчасово недоступний." },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST };
