import { generateText, Output } from "ai";
import type { ZodType } from "zod";

import { requireProvider } from "./client";
import { GENERATION_MODEL } from "./models";

export type GenerateStructuredInput<T> = {
  model?: string;
  prompt: string;
  schema: ZodType<T>;
};

export const generateStructured = async <T>({
  model = GENERATION_MODEL,
  prompt,
  schema,
}: GenerateStructuredInput<T>): Promise<T> => {
  const provider = requireProvider();
  const { output } = await generateText({
    model: provider(model),
    output: Output.object({ schema }),
    prompt,
  });
  return output;
};

export { GENERATION_MODEL } from "./models";
