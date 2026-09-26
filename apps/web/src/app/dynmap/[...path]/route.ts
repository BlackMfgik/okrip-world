import { dynmapProxy } from "@/lib/dynmap-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dynmap сервера SMP (адреса в DYNMAP_ORIGIN).
const handlers = dynmapProxy("DYNMAP_ORIGIN");
export const GET = handlers.GET;
export const HEAD = handlers.HEAD;
export const OPTIONS = handlers.OPTIONS;
