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
              Оберіть сервер, увійдіть через Discord і подайте заявку на гру.
            </p>
          </header>

          <div className="servers-grid">
            {Array.from({ length: 2 }, (_, index) => (
              <div className="server-card-entry" key={index}>
                <ServerCard server={SERVERS[0]!} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}



