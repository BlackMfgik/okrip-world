import { dynmapProxy } from "@/lib/dynmap-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dynmap сервера SMP (адреса в DYNMAP_ORIGIN). Поки сервер не запущено, мапа відкрита лише адмінам.
const handlers = dynmapProxy("DYNMAP_ORIGIN", { adminOnly: true });
export const GET = handlers.GET;
export const HEAD = handlers.HEAD;
export const OPTIONS = handlers.OPTIONS;
