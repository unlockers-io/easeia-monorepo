import "dotenv/config";

import {
  requireProvider,
  REWRITE_MODEL as REWRITER_MODEL,
  GENERATION_MODEL as GRADER_MODEL,
} from "@repo/ai";
import {
  buildRewritePrompt,
  EVAL_CASES,
  EVAL_LANGUAGE_TO_SITE,
  type EvalCase,
} from "@repo/rewrite";
import { generateText, Output } from "ai";
import { z } from "zod";

const argv = process.argv.slice(2);
const langFilter = argv.find((a) => a.startsWith("--lang="))?.slice("--lang=".length);
const caseFilter = argv.find((a) => a.startsWith("--case="))?.slice("--case=".length);

const rewriteSchema = z.object({
  body: z.string().min(50),
  excerpt: z.string().min(20).max(300),
  focusKeyword: z.string().min(2).max(80),
  title: z.string().min(10).max(120),
});

const gradingResultSchema = z.object({ pass: z.boolean(), reason: z.string() });

const buildGradingSchema = (assertionCount: number) =>
  z.object({
    notes: z.string(),
    results: z.array(gradingResultSchema).length(assertionCount),
  });

const runCase = async (
  evalCase: EvalCase,
  provider: ReturnType<typeof requireProvider>,
): Promise<{
  caseId: string;
  failures: Array<string>;
  lang: string;
  passed: number;
  total: number;
}> => {
  const prompt = buildRewritePrompt({
    anchors: [],
    moneySiteName: "Acme Studios",
    post: {
      body: evalCase.body,
      excerpt: evalCase.excerpt,
      focusKeyword: evalCase.focusKeyword,
      niches: ["WEDDING"],
      tags: [],
      title: evalCase.title,
    },
    siteDomain: "eval.localhost",
    siteLanguage: EVAL_LANGUAGE_TO_SITE[evalCase.language],
    siteNiches: ["WEDDING"],
  });

  const { output: rewrite } = await generateText({
    model: provider(REWRITER_MODEL),
    output: Output.object({ schema: rewriteSchema }),
    prompt,
  });

  const gradingPrompt = [
    "You are grading a blog post rewrite against a checklist.",
    "Score every assertion strictly pass/fail. Brief reason per assertion.",
    "",
    `Original title: ${evalCase.title}`,
    `Original body: ${evalCase.body}`,
    "",
    `Rewritten title: ${rewrite.title}`,
    `Rewritten body: ${rewrite.body}`,
    "",
    "Assertions to grade (in order):",
    ...evalCase.assertions.map((a, i) => `${i + 1}. ${a.description}`),
  ].join("\n");

  const { output: grading } = await generateText({
    model: provider(GRADER_MODEL),
    output: Output.object({ schema: buildGradingSchema(evalCase.assertions.length) }),
    prompt: gradingPrompt,
  });

  const failures = grading.results
    .map((r, i) => (r.pass ? null : `   - ${evalCase.assertions[i]?.description}: ${r.reason}`))
    .filter((line): line is string => line !== null);

  return {
    caseId: evalCase.id,
    failures,
    lang: evalCase.language,
    passed: grading.results.filter((r) => r.pass).length,
    total: grading.results.length,
  };
};

const main = async (): Promise<number> => {
  const cases = EVAL_CASES.filter((c) => {
    if (langFilter !== undefined && langFilter !== "" && c.language !== langFilter) {
      return false;
    }
    if (caseFilter !== undefined && caseFilter !== "" && !c.id.includes(caseFilter)) {
      return false;
    }
    return true;
  });
  if (cases.length === 0) {
    console.log("No cases matched filters.");
    return 0;
  }

  const provider = requireProvider();
  console.log(`Running ${cases.length} case${cases.length === 1 ? "" : "s"}…`);

  const results: Array<Awaited<ReturnType<typeof runCase>>> = [];
  for (const c of cases) {
    const r = await runCase(c, provider);
    results.push(r);
    const status = r.passed === r.total ? "PASS" : "FAIL";
    console.log(`[${r.lang.toUpperCase()}] ${r.caseId}: ${status} (${r.passed}/${r.total})`);
    for (const f of r.failures) {
      console.log(f);
    }
  }

  const totals = results.reduce(
    (acc, r) => ({ passed: acc.passed + r.passed, total: acc.total + r.total }),
    { passed: 0, total: 0 },
  );
  console.log(`\nOverall: ${totals.passed} / ${totals.total} assertions passed`);
  return totals.passed === totals.total ? 0 : 1;
};

try {
  process.exit(await main());
} catch (error) {
  console.error(error);
  process.exit(1);
}
