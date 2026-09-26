import type { Metadata } from "next";

export const SITE_NAME = "Okrip World";

export const SITE_URL = new URL("https://okrip.world");

export const SITE_OG_IMAGE = {
  url: "/og-image.jpg",
  width: 2000,
  height: 1125,
  alt: "Кам'яний ангел Okrip World на тлі дощового неба",
};

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
      images: [SITE_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SITE_OG_IMAGE],
    },
  };
}
