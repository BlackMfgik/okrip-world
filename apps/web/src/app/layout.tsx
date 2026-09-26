import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { Toast } from "@/components/toast";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_SOCIALS,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "Okrip World — Українська Minecraft-спільнота",
    template: "%s | Okrip World",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Okrip World",
    "Okrip",
    "український Minecraft сервер",
    "Minecraft сервер Україна",
    "ванільний Minecraft сервер",
    "Minecraft Java сервер",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: {
    icon: [{ url: "/content/OiOi.svg", type: "image/svg+xml" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: "/",
    siteName: SITE_NAME,
    title: "Okrip World — Українська Minecraft-спільнота",
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Okrip World — Українська Minecraft-спільнота",
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#090909",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: SITE_NAME,
      url: SITE_URL.toString(),
      logo: new URL("/content/OiOi.svg", SITE_URL).toString(),
      description: SITE_DESCRIPTION,
      sameAs: SITE_SOCIALS,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: SITE_NAME,
      url: SITE_URL.toString(),
      inLanguage: "uk-UA",
      publisher: { "@id": `${SITE_URL}#organization` },
    },
  ],
};

const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem("theme") === "light") {
    document.documentElement.classList.add("light-theme");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Shared App Router layout loads this font on every route. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
          type="application/ld+json"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <div className="wrap">{children}</div>
          <Toast />
        </Providers>
      </body>
    </html>
  );
}
