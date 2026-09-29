import { analyzeBody } from "@repo/posts";

/**
 * A legitimate rewrite restructures prose and can add a section, but it does
 * not multiply length. The largest genuine growth in the corpus is well under
 * 2x; 3x leaves room without admitting a doubling.
 */
const MAX_GROWTH_FACTOR = 3;

/**
 * Below this the ratio is meaningless: WordPress migration left short stubs
 * behind, and turning a 200-character stub into a real article is the rewriter
 * working, not running away. Duplication is still caught, by the check above.
 */
const RATIO_APPLIES_ABOVE_CHARS = 2000;

export class RewriteOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewriteOutputError";
  }
}

export type RewriteGuardInput = {
  after: string;
  before: string;
  postId: string;
};

export const assertRewriteIsSane = ({ after, before, postId }: RewriteGuardInput): void => {
  const analysis = analyzeBody(after);
  if (analysis.isCorrupt) {
    throw new RewriteOutputError(
      `Rewrite for post ${postId} repeats ${analysis.duplicatedSubstantial} substantial blocks; the model echoed its input. Refusing to write.`,
    );
  }
  if (
    before.length >= RATIO_APPLIES_ABOVE_CHARS &&
    after.length > before.length * MAX_GROWTH_FACTOR
  ) {
    throw new RewriteOutputError(
      `Rewrite for post ${postId} grew ${before.length} to ${after.length} chars, past the ${MAX_GROWTH_FACTOR}x ceiling. Refusing to write.`,
    );
  }
};
