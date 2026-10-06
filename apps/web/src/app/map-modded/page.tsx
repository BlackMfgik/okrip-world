import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { MapFrame } from "@/features/maps/components/map-frame";
import { isAdminSession } from "@/lib/admin-session";
import { createDynmapToken } from "@/features/maps/server/dynmap-token";
import { pageMetadata } from "@/lib/site";

// DYNMAP_ORIGIN і сесія адміна читаються під час запиту, щоб змінна з Railway діяла без перезбирання.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata(
    "Мапа сервера SMP | Okrip World",
    "Жива мапа сервера SMP спільноти Okrip World.",
    "/map-modded",
  ),
  robots: {
    index: false,
    follow: true,
  },
};

export default async function MapModdedPage() {
  // Поки сервер SMP не запущено, мапу бачать лише адміни сайту: сторінка перевіряє
  // сесію і видає токен, без якого проксі /dynmap/ нічого не віддає.
  const isAdmin = await isAdminSession();
  const token =
    isAdmin && process.env.DYNMAP_ORIGIN ? createDynmapToken() : null;

  return (
    <div style={{ height: "100vh" }}>
      <Nav />

      <main className="body">
        <h1 className="sr-only">Мапа сервера SMP Okrip World</h1>
        <MapFrame
          base={token ? `/dynmap/${token}/` : undefined}
          title="Dynmap — сервер SMP Okrip World"
          unavailableText={
            isAdmin ? undefined : "МАПА SMP ПОКИ ДОСТУПНА ЛИШЕ АДМІНІСТРАЦІЇ"
          }
        />
      </main>
    </div>
  );
}
