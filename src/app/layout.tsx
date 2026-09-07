import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Toast } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Okrip World",
  icons: {
    icon: "/content/OiOi.svg",
  },
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
