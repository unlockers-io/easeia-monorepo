/** Ahrefs bars: title 30–60 chars, meta description 70–160. Zero in-content inbound ≈ orphan. */

export const SEO_TITLE_MIN = 30;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MIN = 70;
export const SEO_DESCRIPTION_MAX = 160;

export type SeoLengthIssue = "missing" | "ok" | "too_long" | "too_short";

export const classifyTitleLength = (title: string): SeoLengthIssue => {
  const n = title.trim().length;
  if (n === 0) {
    return "missing";
  }
  if (n < SEO_TITLE_MIN) {
    return "too_short";
  }
  if (n > SEO_TITLE_MAX) {
    return "too_long";
  }
  return "ok";
};

export const classifyDescriptionLength = (excerpt: string | null | undefined): SeoLengthIssue => {
  if (excerpt === null || excerpt === undefined) {
    return "missing";
  }
  const n = excerpt.trim().length;
  if (n === 0) {
    return "missing";
  }
  if (n < SEO_DESCRIPTION_MIN) {
    return "too_short";
  }
  if (n > SEO_DESCRIPTION_MAX) {
    return "too_long";
  }
  return "ok";
};

export type OnPageIssueKind =
  | "description_too_long"
  | "description_too_short"
  | "no_inbound_internal"
  | "title_too_long"
  | "title_too_short";

export type OnPagePostInput = {
  excerpt: string | null;
  inboundInternal: number;
  title: string;
};

export const onPageIssuesForPost = (post: OnPagePostInput): Array<OnPageIssueKind> => {
  const issues: Array<OnPageIssueKind> = [];
  const title = classifyTitleLength(post.title);
  if (title === "missing" || title === "too_short") {
    issues.push("title_too_short");
  }
  if (title === "too_long") {
    issues.push("title_too_long");
  }
  const description = classifyDescriptionLength(post.excerpt);
  if (description === "missing" || description === "too_short") {
    issues.push("description_too_short");
  }
  if (description === "too_long") {
    issues.push("description_too_long");
  }
  if (post.inboundInternal === 0) {
    issues.push("no_inbound_internal");
  }
  return issues;
};

export type OnPageCounts = {
  descriptionTooLong: number;
  descriptionTooShort: number;
  noInboundInternal: number;
  published: number;
  titleTooLong: number;
  titleTooShort: number;
};

export const summarizeOnPage = (posts: ReadonlyArray<OnPagePostInput>): OnPageCounts => {
  const counts: OnPageCounts = {
    descriptionTooLong: 0,
    descriptionTooShort: 0,
    noInboundInternal: 0,
    published: posts.length,
    titleTooLong: 0,
    titleTooShort: 0,
  };
  for (const post of posts) {
    const issues = onPageIssuesForPost(post);
    if (issues.includes("title_too_short")) {
      counts.titleTooShort += 1;
    }
    if (issues.includes("title_too_long")) {
      counts.titleTooLong += 1;
    }
    if (issues.includes("description_too_short")) {
      counts.descriptionTooShort += 1;
    }
    if (issues.includes("description_too_long")) {
      counts.descriptionTooLong += 1;
    }
    if (issues.includes("no_inbound_internal")) {
      counts.noInboundInternal += 1;
    }
  }
  return counts;
};
