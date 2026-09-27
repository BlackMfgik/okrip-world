import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Мінімальний сервер з лише потрібними залежностями — Docker-образ у рази менший.
  output: "standalone",
  // Корінь монорепо, щоб трасування підхопило @okrip/contracts із packages/.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/avatars/**",
      },
    ],
  },
};

export default nextConfig;
