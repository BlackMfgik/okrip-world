import Link from "next/link";
import { IpRow } from "@/components/ip-row";
import type { ServerConfig } from "@/lib/servers";

export function ServerCard({ server }: { server: ServerConfig }) {
  return (
    <div className="server-card">
      <div className="server-card-header">
        <div className="server-name">{server.name}</div>
        <div className="server-status">ONLINE</div>
      </div>
      <div className="server-ip-section">
        <IpRow label="IP Адреса" value={server.ip} />
        <IpRow label="Порт" value={String(server.port)} />
      </div>
      <div className="server-card-footer">
        <Link href={server.mapHref} className="btn-map">
          Мапа →
        </Link>
      </div>
    </div>
  );
}
