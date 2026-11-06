import * as Posts from "@repo/posts";

import { generatePostImage } from "./generate-image";
import type { GeneratePostImageDeps } from "./generate-image";

const SHOTS: ReadonlyArray<string> = [
  "wide establishing shot",
  "medium shot",
  "tight detail close-up",
  "over-the-shoulder shot",
  "low-angle shot",
  "overhead flat-lay",
];

const LENSES: ReadonlyArray<string> = [
  "24mm wide angle",
  "35mm",
  "50mm",
  "85mm with compressed background",
  "100mm macro",
];

const LIGHTS: ReadonlyArray<string> = [
  "flat overcast daylight",
  "hard afternoon sun with defined shadows",
  "blue hour dusk",
  "tungsten practicals in frame",
  "diffused north-facing window light",
  "backlit rim light against a dark background",
];

const PALETTES: ReadonlyArray<string> = [
  "cool desaturated palette",
  "warm amber palette",
  "high-contrast neutral palette",
  "muted pastel palette",
  "deep saturated palette",
];

const hashSlug = (slug: string): number => {
  let hash = 2_166_136_261;

  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash;
};

const AXIS_SALTS = {
  lens: 2_246_822_519,
  light: 3_266_489_917,
  palette: 668_265_295,
  shot: 2_654_435_761,
} as const;

const pick = (options: ReadonlyArray<string>, hash: number, salt: number): string => {
  const index = Math.imul(hash, salt) % options.length;
  const option = options[(index + options.length) % options.length];

  if (option === undefined) {
    throw new Error("pick: options must not be empty");
  }

  return option;
};

/**
 * Deterministic look for a seed. Body images seed on `${slug}-${index}` so the
 * three photos in one post don't come back as near-identical frames.
 */
const buildLook = (seed: string): string => {
  const hash = hashSlug(seed);

  return [
    pick(SHOTS, hash, AXIS_SALTS.shot),
    pick(LENSES, hash, AXIS_SALTS.lens),
    pick(LIGHTS, hash, AXIS_SALTS.light),
    pick(PALETTES, hash, AXIS_SALTS.palette),
  ].join(", ");
};

const FRAMING =
  "16:9 landscape framing, photographic realism, no text, no logos, no watermarks, no people staring into camera.";

const resolveImageStyle = (style: string | null, fallback: string): string => {
  const trimmed = style?.trim() ?? "";

  return trimmed === "" ? fallback : trimmed;
};

export const buildHeroPrompt = (
  style: string | null,
  post: { slug: string; tags: ReadonlyArray<string>; title: string },
): string => {
  const imageStyle = resolveImageStyle(
    style,
    "Editorial blog hero photograph of the post's subject.",
  );

  const tagHint = post.tags.length > 0 ? ` Themes: ${post.tags.slice(0, 4).join(", ")}.` : "";

  return [
    `${imageStyle} Hero image for a blog post titled: "${post.title}".${tagHint}`,
    `Shot as: ${buildLook(post.slug)}.`,
    FRAMING,
  ].join(" ");
};

/**
 * `subject` is the per-image description the planning pass produced, so this
 * illustrates one passage rather than the post as a whole.
 */
export const buildBodyImagePrompt = (input: {
  index: number;
  slug: string;
  style: string | null;
  subject: string;
}): string => {
  const style = resolveImageStyle(
    input.style,
    "Editorial blog photograph illustrating the passage's subject.",
  );

  return [
    `${style} Illustration for a passage in a blog post, depicting: "${input.subject}".`,
    `Shot as: ${buildLook(`${input.slug}-${input.index}`)}.`,
    FRAMING,
  ].join(" ");
};

type GenerateHeroPost = {
  id: string;
  siteId: string;
  slug: string;
  tags: ReadonlyArray<string>;
  title: string;
};

type GenerateHeroDeps = GeneratePostImageDeps & { setHero?: typeof Posts.setHero };

export const generateHero = async (
  input: { post: GenerateHeroPost; site: { imageStyle: string | null } },
  { setHero = Posts.setHero, ...imageDeps }: GenerateHeroDeps = {},
): Promise<void> => {
  const filename = `${input.post.slug}.jpg`;

  const image = await generatePostImage(
    {
      filename,
      post: { id: input.post.id, siteId: input.post.siteId },
      prompt: buildHeroPrompt(input.site.imageStyle, input.post),
    },
    imageDeps,
  );

  await setHero(input.post.id, {
    blobKey: image.key,
    blobUrl: image.url,
    filename,
    height: image.height,
    mime: image.mime,
    width: image.width,
  });
};

export { generatePostImage } from "./generate-image";
