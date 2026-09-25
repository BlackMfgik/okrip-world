import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { MapFrame } from "@/components/map-frame";
import { pageMetadata } from "@/lib/site";

// DYNMAP_VANILLA_ORIGIN читається під час запиту, щоб змінна з Railway діяла без перезбирання.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata(
    "Мапа ванільного сервера | Okrip World",
    "Жива мапа ванільного Minecraft-сервера Okrip World: світ, гравці онлайн і мітки.",
    "/map-vanilla",
  ),
  robots: {
    index: false,
    follow: true,
  },
};

export default function MapVanillaPage() {
  return (
    <div style={{ height: "100vh" }}>
      <Nav />

      <main className="body">
        <h1 className="sr-only">Мапа ванільного сервера Okrip World</h1>
        <MapFrame
          base={process.env.DYNMAP_VANILLA_ORIGIN ? "/dynmap-vanilla/" : undefined}
          title="Dynmap — ванільний сервер Okrip World"
        />
      </main>
    </div>
  );
}
