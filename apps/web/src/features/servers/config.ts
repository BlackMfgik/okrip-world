export interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  mapHref: string;
  /** Шлях проксі Dynmap цього сервера; з нього береться окремий онлайн. */
  dynmapPath: string;
  applicationsEnabled?: boolean;
}

export const SERVERS: ServerConfig[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    ip: "okrip.world",
    port: 25594,
    mapHref: "/map-vanilla",
    dynmapPath: "/dynmap-vanilla",
  },
  {
    id: "modded",
    name: "Amega",
    ip: "okrip.world",
    port: 25594,
    mapHref: "/map-modded",
    dynmapPath: "/dynmap",
    applicationsEnabled: true,
  },
];
