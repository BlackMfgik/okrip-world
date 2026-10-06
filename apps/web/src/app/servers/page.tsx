import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { ServersPage } from "@/features/servers/components/ServersPage";

export const metadata: Metadata = pageMetadata(
  "IP українського Minecraft-сервера Okrip World — сервери та порт",
  "IP-адреса й порт українського ванільного Minecraft-сервера Okrip World (Java 1.21), заявка у вайтліст через Discord і жива мапа світу.",
  "/servers",
);

export default ServersPage;
