import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return { rules: { allow: "/", userAgent: "*" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
