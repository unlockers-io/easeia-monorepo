import { BRAND_IMAGE_SIZE, brandImage } from "@repo/social-image/brand";
import { ImageResponse } from "next/og";

import { DESCRIPTION, SITE_NAME } from "@/lib/site";

const alt = `${SITE_NAME} · ${DESCRIPTION}`;
const size = BRAND_IMAGE_SIZE;
const contentType = "image/png";

const OpengraphImage = () => new ImageResponse(brandImage(DESCRIPTION), size);

export { alt, contentType, size };

export default OpengraphImage;
