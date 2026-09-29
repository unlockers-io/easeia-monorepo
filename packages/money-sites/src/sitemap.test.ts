import { describe, expect, it } from "vitest";

import { extractLocs, filterContentPaths } from "./sitemap";

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://example.com/</loc></url>
<url><loc>https://example.com/spaces/casa-jardim</loc></url>
<url><loc>https://example.com/spaces/atelie</loc></url>
<url><loc>https://example.com/contact</loc></url>
</urlset>`;

describe("extractLocs", () => {
  it("returns every <loc> value", () => {
    expect(extractLocs(sitemapXml)).toEqual([
      "https://example.com/",
      "https://example.com/spaces/casa-jardim",
      "https://example.com/spaces/atelie",
      "https://example.com/contact",
    ]);
  });

  it("returns empty array for malformed XML", () => {
    expect(extractLocs("not xml at all")).toEqual([]);
  });
});

describe("filterContentPaths", () => {
  it("keeps URLs whose path starts with the prefix", () => {
    const urls = [
      "https://example.com/",
      "https://example.com/spaces/casa-jardim",
      "https://example.com/spaces/atelie",
      "https://example.com/contact",
    ];
    expect(filterContentPaths(urls, "/spaces/")).toEqual([
      "https://example.com/spaces/casa-jardim",
      "https://example.com/spaces/atelie",
    ]);
  });

  it("returns all URLs when prefix is null", () => {
    const urls = ["https://example.com/", "https://example.com/contact"];
    expect(filterContentPaths(urls, null)).toEqual(urls);
  });
});

describe("extractLocs deduplication", () => {
  it("returns each loc once even when the sitemap repeats it", () => {
    const xml = `<urlset>
      <url><loc>https://a.test/x</loc></url>
      <url><loc>https://a.test/x</loc></url>
      <url><loc>https://a.test/y</loc></url>
    </urlset>`;

    expect(extractLocs(xml)).toEqual(["https://a.test/x", "https://a.test/y"]);
  });
});
