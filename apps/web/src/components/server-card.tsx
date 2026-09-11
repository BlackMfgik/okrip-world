import Link from "next/link";
import { ServerApplicationAction } from "@/features/application/components/ServerApplicationAction";
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
        <Link href={server.mapHref} className="btn-map" aria-label={`Мапа сервера ${server.name}`}>
          Мапа →
        </Link>
      </div>
      {server.id === "vanilla" && <ServerApplicationAction />}
    </div>
  );
}
