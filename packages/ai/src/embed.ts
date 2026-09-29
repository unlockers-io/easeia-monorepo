import { embed } from "ai";

import { requireProvider } from "./client";
import { EMBED_MODEL } from "./models";

export const embedText = async (value: string): Promise<Array<number>> => {
  const provider = requireProvider();
  const { embedding } = await embed({
    model: provider.embedding(EMBED_MODEL),
    value,
  });
  return embedding;
};

export { EMBED_MODEL } from "./models";
