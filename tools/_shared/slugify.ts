/**
 * Mirrors astro-awesomeness/lib's slugify. The blogs render category and tag
 * URLs from it, so a divergence here would report a rename as safe while it
 * moves an indexed page. Keep the two in step.
 */
export const slugify = (input: string): string =>
  input
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/gu, "")
    .trim()
    .replaceAll(/[\s-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
