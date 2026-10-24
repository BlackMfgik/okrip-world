import path from "node:path";
import type { NextConfig } from "next";

const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Мінімальний сервер з лише потрібними залежностями — Docker-образ у рази менший.
  output: "standalone",
  // Корінь монорепо, щоб трасування підхопило @okrip/contracts із packages/.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Не розкриваємо фреймворк у відповідях (x-powered-by: Next.js).
  poweredByHeader: false,
  images: {
    // Лише аватари Discord; Cloudinary-фони підключені через CSS і оптимізатор не потребують.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/avatars/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Сторінки сайту, зокрема /admin, не вбудовуються в чужі iframe (clickjacking).
        // Повна CSP зі script-src потребує nonce для inline-скриптів layout — окрема задача.
        source: "/((?!dynmap/|dynmap-vanilla/).*)",
        headers: [
          ...commonSecurityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Dynmap вбудовується в iframe сторінок мапи. CSP (sandbox + frame-ancestors) і
        // Referrer-Policy ставить сам проксі: Next не замінює заголовок, уже заданий тут.
        source: "/:prefix(dynmap|dynmap-vanilla)/:path*",
        headers: [
          ...commonSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
