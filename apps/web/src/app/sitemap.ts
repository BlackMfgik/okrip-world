import type { MetadataRoute } from "next";
import { ABOUT_PATH, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/servers", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: new URL(ABOUT_PATH, SITE_URL).toString(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
