import {
  BRAND_INK,
  BRAND_PAPER,
  MARK_PATH,
  MARK_STROKE_WIDTH,
  MARK_VIEWBOX,
} from "@repo/ui/lib/brand";
import { createElement } from "react";

import { svgText } from "./index";

const BRAND_IMAGE_SIZE = { height: 630, width: 1200 };
const BRAND_ICON_SIZE = { height: 180, width: 180 };

const mark = (transform: string) =>
  createElement(
    "g",
    { transform },
    createElement("path", {
      d: MARK_PATH,
      fill: BRAND_INK,
      stroke: BRAND_PAPER,
      strokeWidth: MARK_STROKE_WIDTH,
    }),
  );

const brandImage = (tagline: string) =>
  createElement(
    "svg",
    { height: 630, viewBox: "0 0 1200 630", width: 1200 },
    createElement("rect", { fill: BRAND_INK, height: 630, width: 1200 }),
    mark("translate(358 219.714) scale(1.14285714286)"),
    svgText("Easeia", { color: BRAND_PAPER, size: 96, tracking: -4.8, x: 506, y: 315 }),
    createElement(
      "g",
      { opacity: 0.7 },
      svgText(tagline, {
        anchor: "middle",
        color: BRAND_PAPER,
        size: 40,
        width: 1040,
        x: 600,
        y: 410,
      }),
    ),
  );

const brandIcon = () =>
  createElement(
    "svg",
    { height: 180, viewBox: "0 0 180 180", width: 180 },
    createElement("rect", { fill: BRAND_INK, height: 180, width: 180 }),
    mark("translate(32 33.66) scale(1.105)"),
  );

const brandMarkSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="105" height="102" fill="none" viewBox="${MARK_VIEWBOX}"><path fill="${BRAND_PAPER}" stroke="${BRAND_INK}" stroke-width="${MARK_STROKE_WIDTH}" d="${MARK_PATH}"/></svg>`;

export { BRAND_ICON_SIZE, BRAND_IMAGE_SIZE, brandIcon, brandImage, brandMarkSvg };
