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

/** Сервери, які ще готуються: картка «Soon» з подачею заявки видна всім, мапа — лише адмінам; в онлайн і лічильник не входять. */
export const UPCOMING_SERVERS: Array<
  Pick<ServerConfig, "id" | "name" | "mapHref">
> = [{ id: "modded", name: "SMP", mapHref: "/map-modded" }];
