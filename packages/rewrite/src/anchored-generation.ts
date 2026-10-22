import { generateStructured } from "@repo/ai";
import type { ZodType } from "zod";

import type { AnchorSpec } from "./prompt";

type AnchoredGenerationInput<T> = {
  anchors: ReadonlyArray<AnchorSpec>;
  insertInstruction: string;
  prompt: string;
  schema: ZodType<T>;
};

type AnchoredGeneration<T> = {
  missing: Array<AnchorSpec>;
  output: T;
  retryUsed: boolean;
};

export const findMissingAnchors = (
  body: string,
  anchors: ReadonlyArray<AnchorSpec>,
): Array<AnchorSpec> => anchors.filter((a) => !body.includes(a.url));

export const generateWithAnchors = async <T extends { body: string }>({
  anchors,
  insertInstruction,
  prompt,
  schema,
}: AnchoredGenerationInput<T>): Promise<AnchoredGeneration<T>> => {
  const first = await generateStructured({ prompt, schema });
  const missingFirst = findMissingAnchors(first.body, anchors);

  if (missingFirst.length === 0) {
    return { missing: missingFirst, output: first, retryUsed: false };
  }

  const urls = missingFirst.map((a) => a.url).join(", ");

  const retried = await generateStructured({
    prompt: `${prompt}\n\nIMPORTANT: your previous output was missing these links: ${urls}. ${insertInstruction}`,
    schema,
  });

  return { missing: findMissingAnchors(retried.body, anchors), output: retried, retryUsed: true };
};
