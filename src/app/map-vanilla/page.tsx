import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { BluemapFrame } from "@/components/bluemap-frame";

export const metadata: Metadata = {
  title: "Креативна Мапа — Okrip World",
};

export default function MapVanillaPage() {
  return (
    <div style={{ height: "100vh" }}>
      <Nav staticOnline="ОНЛАЙН 67" />

      <div className="body">
        <BluemapFrame title="BlueMap - Креатив" />
      </div>
    </div>
  );
}
