import { NextRequest, NextResponse } from "next/server";

// Проксі до вбудованого вебсервера Dynmap на Minecraft-сервері (Kinetic).
// Сайт працює по HTTPS, Dynmap — по HTTP на окремому порту, тому iframe напряму
// заблокується як mixed content. Клієнт Dynmap ходить лише відносними шляхами
// (standalone/config.js, up/…, tiles/…), тож достатньо віддати його з /dynmap/…/.
// Кожен сервер має свій маршрут і свою змінну середовища з адресою Dynmap.

const FORWARDED_REQUEST_HEADERS = ["accept", "if-none-match", "if-modified-since"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "etag", "last-modified"];

// Скін під стиль сайту: public/dynmap-skin.css і dynmap-skin.js. Змініть версію після правок у них.
const SKIN_VERSION = "3";

// У sandbox-документі (без allow-same-origin) звернення до document.cookie чи localStorage
// кидає SecurityError і зупиняє клієнт Dynmap. Підміняємо їх порожнім сховищем у пам'яті
// до завантаження скриптів Dynmap — доступу до даних сайту це не дає.
const SANDBOX_SHIM = `<script>(function(){
try{document.cookie}catch(e){var c="";Object.defineProperty(document,"cookie",{configurable:true,get:function(){return c},set:function(){}})}
function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n]}catch(e){try{Object.defineProperty(window,n,{configurable:true,value:mem()})}catch(_){}}});
})();</script>`;

/** Підключає скін до index.html Dynmap і ставить клас теми сайту (?theme=light). */
function applySkin(html: string, theme: string | null) {
  const themeClass = theme === "light" ? "okrip-light" : "okrip-dark";
  return html
    .replace(/<html([^>]*)>/i, `<html$1 class="${themeClass}">`)
    .replace(/<head([^>]*)>/i, `<head$1>${SANDBOX_SHIM}`)
    .replace(
      /<\/head>/i,
      `<link rel="stylesheet" href="/dynmap-skin.css?v=${SKIN_VERSION}" />` +
        `<script src="/dynmap-skin.js?v=${SKIN_VERSION}" defer></script></head>`,
    );
}

function cacheControl(path: string) {
  // up/… — живі оновлення (гравці, чат, час); кешувати не можна.
  if (path.startsWith("up/")) return "no-store";
  if (path.startsWith("tiles/"))
    return path.endsWith(".json") ? "public, max-age=30" : "public, max-age=600";
  // index.html щоразу збирається зі скіном — нехай браузер перевіряє його щоразу.
  if (path === "index.html") return "no-cache";
  // JS/CSS/іконки клієнта Dynmap змінюються лише з оновленням плагіна.
  return "public, max-age=3600";
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(
  originEnv: string,
  request: NextRequest,
  { params }: RouteContext,
) {
  const origin = process.env[originEnv];
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
    const skinned =
      path === "index.html" &&
      request.method === "GET" &&
      upstream.ok &&
      (upstream.headers.get("content-type") ?? "").includes("text/html");
    const response = new NextResponse(
      request.method === "HEAD"
        ? null
        : skinned
          ? applySkin(await upstream.text(), request.nextUrl.searchParams.get("theme"))
          : upstream.body,
      { status: upstream.status },
    );
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      // ETag/Last-Modified оригіналу не описують змінений index.html.
      if (skinned && name !== "content-type") continue;
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

// Клієнт Dynmap шле XHR із додатковими заголовками, тож браузер спершу робить CORS preflight
// з opaque origin sandbox-документа. Дозволено лише читання, без cookies.
function preflight() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/** Обробники маршруту /<шлях>/[...path] для Dynmap, адреса якого лежить у змінній originEnv. */
export function dynmapProxy(originEnv: string) {
  const handler = (request: NextRequest, context: RouteContext) =>
    proxy(originEnv, request, context);
  return { GET: handler, HEAD: handler, OPTIONS: preflight };
}
