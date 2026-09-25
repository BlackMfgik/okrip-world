import { dynmapProxy } from "@/lib/dynmap-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dynmap сервера Vanilla (адреса в DYNMAP_VANILLA_ORIGIN).
const handlers = dynmapProxy("DYNMAP_VANILLA_ORIGIN");
export const GET = handlers.GET;
export const HEAD = handlers.HEAD;
export const OPTIONS = handlers.OPTIONS;
