import { origins } from "@repo/identity";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { allow: "/", userAgent: "*" }, sitemap: `${origins.landing}/sitemap.xml` };
}
