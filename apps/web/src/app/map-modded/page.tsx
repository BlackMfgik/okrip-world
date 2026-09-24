import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { MapFrame } from "@/components/map-frame";
import { pageMetadata } from "@/lib/site";

// DYNMAP_ORIGIN читається під час запиту, щоб змінна з Railway діяла без перезбирання.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata(
    "Мапа сервера Modded | Okrip World",
    "Жива мапа сервера Modded спільноти Okrip World.",
    "/map-modded",
  ),
  robots: {
    index: false,
    follow: true,
  },
};

export default function MapModdedPage() {
  return (
    <div style={{ height: "100vh" }}>
      <Nav />

      <main className="body">
        <h1 className="sr-only">Мапа сервера Modded Okrip World</h1>
        <MapFrame
          base={process.env.DYNMAP_ORIGIN ? "/dynmap/" : undefined}
          title="Dynmap — сервер Modded Okrip World"
        />
      </main>
    </div>
  );
}
