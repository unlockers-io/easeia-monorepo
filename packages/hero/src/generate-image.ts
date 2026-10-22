import { generateImage as aiGenerateImage } from "@repo/ai";
import { upload as blobUpload } from "@repo/blob";
import sharp from "sharp";

export type GeneratePostImageDeps = {
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

const defaultToJpeg = async (
  png: Uint8Array,
): Promise<{ bytes: Uint8Array; height: number; width: number }> => {
  const out = await sharp(png)
    .jpeg({ mozjpeg: true, quality: 85 })
    .toBuffer({ resolveWithObject: true });

  return { bytes: new Uint8Array(out.data), height: out.info.height, width: out.info.width };
};

/**
 * Prompt in, uploaded JPEG out. Each caller persists its own image record.
 */
export const generatePostImage = async (
  input: GeneratePostImageInput,
  deps: GeneratePostImageDeps = {},
): Promise<GeneratePostImageResult> => {
  const generateImage = deps.generateImage ?? aiGenerateImage;
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
