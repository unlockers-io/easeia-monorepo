import { describe, expect, it } from "vitest";

import { brandImage, brandMarkSvg } from "./brand";

describe("brandImage", () => {
  it("renders a 1200x630 card for the tagline", () => {
    const image = brandImage("Multi-Site Astro Orchestrator");

    expect(image.props).toMatchObject({ height: 630, viewBox: "0 0 1200 630", width: 1200 });
  });
});

describe("brandMarkSvg", () => {
  it("is a standalone SVG document of the mark", () => {
    expect(brandMarkSvg()).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*><path [^>]+\/><\/svg>$/v,
    );
  });
});
