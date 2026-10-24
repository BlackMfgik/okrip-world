export interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  mapHref: string;
  applicationsEnabled?: boolean;
}

export const SERVERS: ServerConfig[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    ip: "okrip.world",
    port: 25594,
    mapHref: "/map-vanilla",
  },
  {
    id: "modded",
    name: "Amega",
    ip: "okrip.world",
    port: 25594,
    mapHref: "/map-modded",
    applicationsEnabled: true,
  },
];
