import { BRAND_IMAGE_SIZE, brandImage } from "@repo/social-image/brand";
import { ImageResponse } from "next/og";

const TAGLINE = "Multi-Site Astro Orchestrator";

const alt = `Easeia · ${TAGLINE}`;
const size = BRAND_IMAGE_SIZE;
const contentType = "image/png";

const OpengraphImage = () => new ImageResponse(brandImage(TAGLINE), size);

export { alt, contentType, size };

export default OpengraphImage;
