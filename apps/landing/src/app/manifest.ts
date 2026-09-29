import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f7f6f2",
    description: "An open-source dashboard for private blog networks.",
    display: "browser",
    icons: [{ sizes: "any", src: "/icon.svg", type: "image/svg+xml" }],
    name: "Easeia",
    short_name: "Easeia",
    start_url: "/",
    theme_color: "#1a1a1a",
  };
}
