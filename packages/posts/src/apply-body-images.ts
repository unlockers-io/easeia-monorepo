export type BodyImage = {
  alt: string;
  /** 1-based line of the body the image is inserted after. */
  line: number;
  url: string;
};

// An unescaped bracket in the alt text terminates the `![...]` early and leaves
// the rest of the markup as visible prose, so the LLM-supplied alt loses them.
const sanitizeAlt = (alt: string): string => alt.replaceAll(/[\[\]]/gv, "").trim();

/**
 * Insert `![alt](url)` after each target line. Targets are resolved against the
 * *original* line numbering: insertions run bottom-up so an earlier image never
 * shifts a later target.
 */
export const applyBodyImages = (body: string, images: ReadonlyArray<BodyImage>): string => {
  const lines = body.split("\n");
  const inRange = images.filter((image) => image.line >= 1 && image.line <= lines.length);
  if (inRange.length === 0) {
    return body;
  }

  const descending = inRange.toSorted((a, b) => b.line - a.line);
  for (const image of descending) {
    lines.splice(image.line, 0, "", `![${sanitizeAlt(image.alt)}](${image.url})`, "");
  }
  return lines
    .join("\n")
    .replaceAll(/\n{3,}/gv, "\n\n")
    .trimEnd();
};
