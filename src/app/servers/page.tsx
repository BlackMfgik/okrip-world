import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { ServerCard } from "@/components/server-card";
import { SERVERS } from "@/lib/servers";

export const metadata: Metadata = {
  title: "Сервери — Okrip World",
};

export default function ServersPage() {
  return (
    <>
      <Nav />

      <div className="body">
        <div className="servers-wrap">
          <div className="servers-night-bg" />
          <div className="servers-day-bg" />

          <div className="page-header">
            <div className="page-title">Сервери</div>
          </div>

          <div className="servers-grid">
            {SERVERS.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
