import Link from "next/link";
import { Nav } from "@/components/nav";
import { ServerCard } from "@/features/servers/components/server-card";
import { SERVERS } from "@/features/servers/config";
import { SupportBanner } from "@/components/support-banner";
import { ABOUT_PATH } from "@/lib/site";

export function ServersPage() {
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
              Оберіть сервер і скопіюйте IP-адресу та порт для підключення.{" "}
              <Link href={ABOUT_PATH}>Більше про сервер</Link>.
            </p>
          </header>

          <div className="servers-grid">
            {SERVERS.map((server) => (
              <div className="server-card-entry" key={server.id}>
                <ServerCard server={server} />
              </div>
            ))}
          </div>

          <SupportBanner />
        </div>
      </main>
    </>
  );
}
