import { NextRequest, NextResponse } from "next/server";

const TARGET_ORIGIN = "http://ip199-83-103-227.joinserver.xyz:25718";

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api\/bluemap/, "") || "/";
  const target = `${TARGET_ORIGIN}${path}${req.nextUrl.search}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { accept: req.headers.get("accept") ?? "*/*" },
    });
    const contentType = upstream.headers.get("content-type") || "";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: upstream.status,
      headers: contentType ? { "content-type": contentType } : undefined,
    });
  } catch {
    return new NextResponse("Proxy error", { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
