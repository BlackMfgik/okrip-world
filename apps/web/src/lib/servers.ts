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
    name: "Vanilla",
    ip: "OkripWorld.mcserver.host",
    port: 25594,
    mapHref: "/map-vanilla",
  },
];

/** Сервери, які ще готуються: показуються на сторінці серверів як «Soon», але не входять в онлайн і лічильник. */
export const UPCOMING_SERVERS: Array<Pick<ServerConfig, "id" | "name">> = [
  { id: "modded", name: "SMP" },
];
