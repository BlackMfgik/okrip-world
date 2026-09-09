import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { BluemapFrame } from "@/components/bluemap-frame";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata(
    "Мапа ванільного сервера | Okrip World",
    "Сторінка мапи ванільного Minecraft-сервера Okrip World. Мапа наразі недоступна.",
    "/map-vanilla",
  ),
  // No map source is configured yet. Re-enable indexing and add to the
  // sitemap once this page contains a working map and useful text.
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
        <BluemapFrame title="BlueMap — ванільний сервер Okrip World" />
      </main>
    </div>
  );
}
