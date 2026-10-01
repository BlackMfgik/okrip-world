import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { ServerCard, UpcomingServerCard } from "@/components/server-card";
import { SERVERS, UPCOMING_SERVERS } from "@/lib/servers";
import { SupportBanner } from "@/components/support-banner";
import { AdminOnly } from "@/features/admin/components/AdminOnly";
import { ABOUT_PATH, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata(
  "IP українського Minecraft-сервера Okrip World — сервери та порт",
  "IP-адреса й порт українського ванільного Minecraft-сервера Okrip World (Java 1.21), заявка у вайтліст через Discord і жива мапа світу.",
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
            {/* Сервери, що готуються, бачить лише адміністрація. */}
            <AdminOnly>
              {UPCOMING_SERVERS.map((server) => (
                <div className="server-card-entry" key={server.id}>
                  <UpcomingServerCard
                    name={server.name}
                    mapHref={server.mapHref}
                  />
                </div>
              ))}
            </AdminOnly>
          </div>

          <SupportBanner />
        </div>
      </main>
    </>
  );
}



