import { SITE_TEXT_MAX_LENGTH, siteUpdatePatchSchema } from "@repo/api-types";
import { z } from "zod";

import { matching } from "@/lib/form-schemas";

export const authorPatchSchema = siteUpdatePatchSchema.pick({
  authorBio: true,
  authorName: true,
  authorPhotoUrl: true,
  authorUrl: true,
});

export const publishingPatchSchema = siteUpdatePatchSchema.pick({
  astroRepoUrl: true,
  imageStyle: true,
  vercelDeployHookUrl: true,
  vercelProjectName: true,
});

const textUpTo = (schema: z.ZodType) =>
  matching(schema, `Keep it to ${SITE_TEXT_MAX_LENGTH} characters.`);

export const authorFormSchema = z.object({
  authorBio: textUpTo(authorPatchSchema.shape.authorBio),
  authorName: textUpTo(authorPatchSchema.shape.authorName),
  authorPhotoUrl: textUpTo(authorPatchSchema.shape.authorPhotoUrl),
  authorUrl: textUpTo(authorPatchSchema.shape.authorUrl),
});

const urlInput = matching(
  publishingPatchSchema.shape.vercelDeployHookUrl,
  "Enter an HTTP(S) URL or leave it blank.",
);

export const publishingFormSchema = z.object({
  astroRepoUrl: urlInput,
  imageStyle: textUpTo(publishingPatchSchema.shape.imageStyle),
  vercelDeployHookUrl: urlInput,
  vercelProjectName: textUpTo(publishingPatchSchema.shape.vercelProjectName),
});
