import type { Metadata } from "next";

export const SITE_NAME = "Okrip World";

export const SITE_URL = new URL("https://okrip-world.vercel.app");

export const SITE_DESCRIPTION =
  "Українська Minecraft-спільнота Okrip World: ванільний сервер, актуальна IP-адреса та спілкування в Discord і Telegram.";

export const SITE_SOCIALS = [
  "https://t.me/okripworld",
  "https://www.youtube.com/@OKRIPp",
  "https://instagram.com/okrip_p",
  "https://discord.gg/UbPaPdfA26",
] as const;

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "uk_UA",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}
