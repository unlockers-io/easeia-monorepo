import { BRAND_INK, BRAND_PAPER, MARK_PATH, MARK_STROKE_WIDTH } from "@repo/ui/lib/brand";
import { ImageResponse } from "next/og";

const size = { height: 180, width: 180 };
const contentType = "image/png";
const AppleIcon = () => {
  return new ImageResponse(
    <svg height={180} viewBox="0 0 180 180" width={180}>
      <rect fill={BRAND_INK} height={180} width={180} />
      <g transform="translate(32 33.66) scale(1.105)">
        <path d={MARK_PATH} fill={BRAND_INK} stroke={BRAND_PAPER} strokeWidth={MARK_STROKE_WIDTH} />
      </g>
    </svg>,
    size,
  );
};
export { contentType, size };
export default AppleIcon;
