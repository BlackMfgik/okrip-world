import Link from "next/link";
import { IpRow } from "@/components/ip-row";
import type { ServerConfig } from "@/lib/servers";

export function ServerCard({ server }: { server: ServerConfig }) {
  return (
    <div className="server-card">
      <div className="server-card-header">
        <h2 className="server-name">{server.name}</h2>
        <div className="server-status">ONLINE</div>
      </div>
      <div className="server-ip-section">
        <IpRow label="IP Адреса" value={server.ip} />
        <IpRow label="Порт" value={String(server.port)} />
      </div>
      <div className="server-card-footer">
        <Link href={server.mapHref} className="btn btn-map" aria-label={`Мапа сервера ${server.name}`}>
          Мапа →
        </Link>
      </div>
    </div>
  );
}

export function UpcomingServerCard({ name }: { name: string }) {
  return (
    <div className="server-card server-card-upcoming">
      <div className="server-card-header">
        <h2 className="server-name">{name}</h2>
        <div className="server-soon-label">SOON</div>
      </div>
      <div className="server-ip-section">
        <IpRow label="IP Адреса" value="Soon…" placeholder />
        <IpRow label="Порт" value="Soon…" placeholder />
      </div>
      {/* Поки сервер не запущено, мапа й подача заявки вимкнені. Щоб увімкнути, поверніть
          <Link href="/map-modded"> і <ServerApplicationAction /> (заявки ведуть на MINECRAFT_SERVER_ID). */}
      <div className="server-card-footer">
        <button className="btn btn-map" disabled type="button">
          Мапа — скоро
        </button>
      </div>
      <div className="server-application">
        <button className="btn btn-primary" disabled type="button">
          Заявки — скоро
        </button>
      </div>
    </div>
  );
}
