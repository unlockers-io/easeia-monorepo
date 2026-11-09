import { BRAND_ICON_SIZE, brandIcon } from "@repo/social-image/brand";
import { ImageResponse } from "next/og";

const size = BRAND_ICON_SIZE;
const contentType = "image/png";

const AppleIcon = () => new ImageResponse(brandIcon(), size);

export { contentType, size };

export default AppleIcon;
