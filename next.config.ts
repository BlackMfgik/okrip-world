import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/bluemap/:path*",
        destination: "/api/bluemap/:path*",
      },
    ];
  },
};

export default nextConfig;
