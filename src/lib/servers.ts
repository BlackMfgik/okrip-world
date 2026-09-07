export interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  mapHref: string;
}

export const SERVERS: ServerConfig[] = [
  {
    id: "vanilla",
    name: "Ваніла",
    ip: "OkripWorld.mcserver.host",
    port: 25594,
    mapHref: "/map-vanilla",
  },
];
