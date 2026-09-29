const modelName = (raw: string | undefined, fallback: string): string => {
  const value = raw?.trim();
  return value === undefined || value === "" ? fallback : value;
};

export const GENERATION_MODEL = modelName(process.env.OPENAI_GENERATION_MODEL, "gpt-5.6-luna");
export const REWRITE_MODEL = modelName(process.env.OPENAI_REWRITE_MODEL, "gpt-5.6-luna");
export const IMAGE_MODEL = modelName(process.env.OPENAI_IMAGE_MODEL, "gpt-image-2");
// Fixed: text-embedding-3-small produces the 1536 dimensions used by pgvector columns.
// Changing this requires a schema migration and re-embedding all stored vectors.
export const EMBED_MODEL = "text-embedding-3-small";
