import { BRAND_INK } from "@repo/ui/lib/brand";
import type { MetadataRoute } from "next";

import { DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f7f6f2",
    description: DESCRIPTION,
    display: "browser",
    icons: [{ sizes: "any", src: "/icon", type: "image/svg+xml" }],
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: "/",
    theme_color: BRAND_INK,
  };
}
