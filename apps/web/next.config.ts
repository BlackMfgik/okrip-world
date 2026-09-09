import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/api/bluemap/:path*", "/bluemap/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }));
  },
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
