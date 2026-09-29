import { AiNotConfiguredError, budgetedOpenAiFetch, IMAGE_MODEL } from "@repo/ai";
import { upload as blobUpload } from "@repo/blob";
import sharp from "sharp";
import { z } from "zod";

export type GeneratePostImageDeps = {
  apiKey?: string;
  blob?: { upload: typeof blobUpload };
  generateImage?: (prompt: string) => Promise<Uint8Array>;
  toJpeg?: (png: Uint8Array) => Promise<{ bytes: Uint8Array; height: number; width: number }>;
};

export type GeneratePostImageInput = {
  filename: string;
  post: { id: string; siteId: string };
  prompt: string;
};

export type GeneratePostImageResult = {
  height: number;
  key: string;
  url: string;
  width: number;
};

const imageEntrySchema = z.object({
  b64_json: z.string().optional(),
  url: z.url().optional(),
});
const imageEntriesSchema = z.array(imageEntrySchema);
const imageResponseSchema = z.object({ data: imageEntriesSchema });
type ImageResponseInput = Parameters<typeof imageResponseSchema.safeParse>[0];

const imageEntryOf = (json: ImageResponseInput) =>
  imageResponseSchema.safeParse(json).data?.data[0];

const defaultGenerateImage =
  (apiKey: string) =>
  async (prompt: string): Promise<Uint8Array> => {
    const quality = process.env.OPENAI_IMAGE_QUALITY?.trim();
    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort(new Error("OpenAI image generation timed out after 120s"));
    }, 120_000);
    let res: Response;
    try {
      res = await budgetedOpenAiFetch("https://api.openai.com/v1/images/generations", {
        body: JSON.stringify({
          model: IMAGE_MODEL,
          n: 1,
          prompt,
          quality: quality === undefined || quality === "" ? "medium" : quality,
          size: "1536x1024",
        }),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        method: "POST",
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    }
    const json: unknown = await res.json();
    const entry = imageEntryOf(json);
    if (entry === undefined) {
      throw new Error("OpenAI returned no image");
    }
    if (typeof entry.b64_json === "string" && entry.b64_json !== "") {
      return new Uint8Array(Buffer.from(entry.b64_json, "base64"));
    }
    if (typeof entry.url !== "string" || entry.url === "") {
      throw new Error("OpenAI returned no url or b64");
    }
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) {
      throw new Error(`download ${imgRes.status} from ${entry.url}`);
    }
    return new Uint8Array(await imgRes.arrayBuffer());
  };

const defaultToJpeg = async (
  png: Uint8Array,
): Promise<{ bytes: Uint8Array; height: number; width: number }> => {
  const out = await sharp(png)
    .jpeg({ mozjpeg: true, quality: 85 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(out.data), height: out.info.height, width: out.info.width };
};

const requireApiKey = (injected: string | undefined): string => {
  const apiKey = injected ?? process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new AiNotConfiguredError();
  }
  return apiKey;
};

/**
 * Prompt in, uploaded JPEG out. Each caller persists its own image record;
 * the shared AI transport records budget reservations.
 */
export const generatePostImage = async (
  input: GeneratePostImageInput,
  deps: GeneratePostImageDeps = {},
): Promise<GeneratePostImageResult> => {
  const generateImage = deps.generateImage ?? defaultGenerateImage(requireApiKey(deps.apiKey));
  const toJpeg = deps.toJpeg ?? defaultToJpeg;
  const blob = deps.blob ?? { upload: blobUpload };

  const png = await generateImage(input.prompt);
  const jpeg = await toJpeg(png);
  const result = await blob.upload({
    bytes: jpeg.bytes,
    filename: input.filename,
    mime: "image/jpeg",
    postId: input.post.id,
    siteId: input.post.siteId,
  });
  return { height: jpeg.height, key: result.key, url: result.url, width: jpeg.width };
};
