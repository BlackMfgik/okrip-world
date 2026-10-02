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
  "Okrip World — український Minecraft-сервер і спільнота українських гравців: ванільне виживання на Java 1.21, вайтліст через Discord, жива мапа світу та спілкування в Discord і Telegram.";

/** Сторінка «Про сервер» — основна текстова сторінка під пошукові запити. */
export const ABOUT_PATH = "/ukrainskyi-minecraft-server";

/**
 * Пошукові фрази, за якими люди шукають українські сервери й спільноти Minecraft.
 * Google мета-тег keywords ігнорує, але Bing та інші пошуковики його ще читають;
 * для Google важливіший текст сторінки «Про сервер».
 */
export const SITE_KEYWORDS = [
  "Okrip World",
  "Okrip",
  "OkripWorld",
  "Окріп Ворлд",
  "окріп майнкрафт",
  "український Minecraft сервер",
  "українські Minecraft сервери",
  "український майнкрафт сервер",
  "українські майнкрафт сервери",
  "україномовний майнкрафт сервер",
  "україномовний Minecraft сервер",
  "майнкрафт сервер українською",
  "Minecraft сервер українською мовою",
  "Minecraft сервер Україна",
  "майнкрафт сервер Україна",
  "сервери майнкрафт Україна",
  "найкращі українські сервери майнкрафт",
  "топ українських серверів Minecraft",
  "українська Minecraft спільнота",
  "українські Minecraft спільноти",
  "українська майнкрафт спільнота",
  "українські майнкрафт спільноти",
  "майнкрафт ком'юніті Україна",
  "Minecraft Discord сервер український",
  "український Discord Minecraft",
  "ванільний Minecraft сервер",
  "ванільний майнкрафт сервер",
  "ванільне виживання майнкрафт",
  "Minecraft SMP Україна",
  "український SMP сервер",
  "Minecraft сервер з вайтлістом",
  "приватний Minecraft сервер",
  "майнкрафт сервер без донату",
  "Minecraft Java сервер",
  "Minecraft 1.21 сервер",
  "IP українського майнкрафт сервера",
  "де пограти в майнкрафт з українцями",
  "Ukrainian Minecraft server",
  "Ukrainian Minecraft community",
  "Minecraft server Ukraine",
];

/** Посилання на банку Monobank для блоку «Підтримай сервер». Порожньо — блок прихований. */
export const SITE_SUPPORT_URL = "https://send.monobank.ua/jar/AXR21BaES1";

export const SITE_DISCORD_URL = "https://discord.gg/UbPaPdfA26";

export const SITE_SOCIALS = [
  "https://t.me/okripworld",
  "https://www.youtube.com/@OKRIPp",
  "https://instagram.com/okrip_p",
  SITE_DISCORD_URL,
] as const;

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title: { absolute: title },
    description,
    keywords: SITE_KEYWORDS,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "uk_UA",
      url: path,
      siteName: SITE_NAME,
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
