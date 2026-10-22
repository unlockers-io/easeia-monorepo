import type { SiteLanguage } from "@repo/db";

const SEE_ALSO: Record<SiteLanguage, string> = {
  EN: "See also",
  ES: "Véase también",
  PT: "Leia também",
};

type Anchor = { anchorText: string; toUrl: string };

const bullet = ({ anchorText, toUrl }: Anchor): string =>
  `- [${anchorText.replaceAll(/[\[\]]/gv, String.raw`\$&`)}](${toUrl})`;

const isSectionHeading = (line: string): boolean => /^#{1,2}\s/v.test(line);

export const withSeeAlsoLinks = (
  body: string,
  anchors: ReadonlyArray<Anchor>,
  language: SiteLanguage,
): string => {
  const missing = new Map<string, Anchor>();

  for (const anchor of anchors) {
    if (!body.includes(anchor.toUrl)) {
      missing.set(anchor.toUrl, anchor);
    }
  }

  if (missing.size === 0) {
    return body;
  }

  const heading = `## ${SEE_ALSO[language]}`;
  const bullets = [...missing.values()].map(bullet);
  const lines = body.trimEnd().split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start === -1) {
    return [...lines, "", heading, "", ...bullets].join("\n");
  }

  const next = lines.findIndex((line, i) => i > start && isSectionHeading(line));
  let end = next === -1 ? lines.length : next;

  while (end > start + 1 && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.toSpliced(end, 0, ...(end === start + 1 ? ["", ...bullets] : bullets)).join("\n");
};
