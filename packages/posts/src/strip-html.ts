export const stripHtml = (html: string): string =>
  html
    .replaceAll(/<!--[\s\S]*?-->/gv, "")
    .replaceAll(/<[^>]+>/gv, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/gv, " ")
    .trim();
