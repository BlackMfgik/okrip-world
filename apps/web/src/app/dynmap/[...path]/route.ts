import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Проксі до вбудованого вебсервера Dynmap на Minecraft-сервері (Kinetic).
// Сайт працює по HTTPS, Dynmap — по HTTP на окремому порту, тому iframe напряму
// заблокується як mixed content. Клієнт Dynmap ходить лише відносними шляхами
// (standalone/config.js, up/…, tiles/…), тож достатньо віддати його з /dynmap/.

const FORWARDED_REQUEST_HEADERS = ["accept", "if-none-match", "if-modified-since"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "etag", "last-modified"];

function cacheControl(path: string) {
  // up/… — живі оновлення (гравці, чат, час); кешувати не можна.
  if (path.startsWith("up/")) return "no-store";
  if (path.startsWith("tiles/"))
    return path.endsWith(".json") ? "public, max-age=30" : "public, max-age=600";
  // HTML/JS/CSS/іконки клієнта Dynmap змінюються лише з оновленням плагіна.
  return "public, max-age=3600";
}

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = process.env.DYNMAP_ORIGIN;
  if (!origin)
    return new NextResponse("Мапу ще не налаштовано.", { status: 503 });

  const { path: segments } = await params;
  if (
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        /[\\/\0]/.test(segment),
    )
  )
    return new NextResponse("Bad request", { status: 400 });

  const path = segments.join("/");
  const target = new URL(
    "/" + segments.map(encodeURIComponent).join("/"),
    origin,
  );
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const response = new NextResponse(
      request.method === "HEAD" ? null : upstream.body,
      { status: upstream.status },
    );
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    response.headers.set("Cache-Control", cacheControl(path));
    // Контент із Minecraft-сервера не повинен виконуватися з origin сайту
    // (інакше скрипт мапи мав би доступ до сесії адміна). sandbox дає документу
    // opaque origin навіть при прямому відкритті, а CORS * дозволяє такому
    // документу читати тайли та оновлення без cookies.
    response.headers.set(
      "Content-Security-Policy",
      "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
    );
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  } catch {
    return new NextResponse("Мапа тимчасово недоступна.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = proxy;
export const HEAD = proxy;
