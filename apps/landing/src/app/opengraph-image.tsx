import { svgText } from "@repo/social-image";
import { BRAND_INK, BRAND_PAPER, MARK_PATH, MARK_STROKE_WIDTH } from "@repo/ui/lib/brand";
import { ImageResponse } from "next/og";

const alt = "Easeia \u00b7 An open-source dashboard for private blog networks.";
const size = { height: 630, width: 1200 };
const contentType = "image/png";
const OpengraphImage = () => {
  return new ImageResponse(
    <svg height={630} viewBox="0 0 1200 630" width={1200}>
      <rect fill={BRAND_INK} height={630} width={1200} />
      <g transform="translate(358 219.714) scale(1.14285714286)">
        <path d={MARK_PATH} fill={BRAND_INK} stroke={BRAND_PAPER} strokeWidth={MARK_STROKE_WIDTH} />
      </g>
      {svgText("Easeia", { color: BRAND_PAPER, size: 96, tracking: -4.8, x: 506, y: 315 })}
      <g opacity={0.7}>
        {svgText("An open-source dashboard for private blog networks.", {
          anchor: "middle",
          color: BRAND_PAPER,
          size: 40,
          width: 1040,
          x: 600,
          y: 410,
        })}
      </g>
    </svg>,
    size,
  );
};
export { alt, contentType, size };
export default OpengraphImage;
