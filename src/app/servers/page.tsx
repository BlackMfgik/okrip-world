import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { ServerCard } from "@/components/server-card";
import { SERVERS } from "@/lib/servers";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata(
  "Сервери Minecraft: IP-адреса та порт | Okrip World",
  "Підключайтеся до ванільного Minecraft-сервера Okrip World. Тут є IP-адреса й порт для входу та посилання на сторінку мапи світу.",
  "/servers",
);

export default function ServersPage() {
  return (
    <>
      <Nav />

      <main className="body">
        <div className="servers-wrap">
          <div className="servers-night-bg" />
          <div className="servers-day-bg" />

          <header className="page-header">
            <h1 className="page-title">Сервери Minecraft</h1>
            <p className="page-description">
              Приєднуйтеся до української Minecraft-спільноти Okrip World.
              Для гри на ванільному сервері скопіюйте IP-адресу та порт нижче.
            </p>
          </header>

          <div className="servers-grid">
            {SERVERS.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
