import { POST_SLUG_PATTERN } from "@repo/api-types";
import { Niche, SiteLanguage } from "@repo/db/browser";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

const passwordsMatch = {
  message: "Passwords do not match",
  path: ["confirmPassword"],
};

export const registerSchema = z
  .object({
    confirmPassword: z.string().min(12, "Password must be at least 12 characters"),
    email: z.email("Invalid email address"),
    name: z.string().min(3, "Name must be at least 3 characters").max(32),
    password: z.string().min(12, "Password must be at least 12 characters"),
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const recoverSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(12, "Password must be at least 12 characters"),
    password: z.string().min(12, "Password must be at least 12 characters"),
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(32),
});

export const changePasswordSchema = z
  .object({
    confirmPassword: z.string().min(12, "Confirm your new password"),
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const isCount = (value: string, max: number) =>
  /^\d+$/v.test(value) && Number(value) >= 1 && Number(value) <= max;

const countField = (max: number) =>
  z
    .string()
    .refine(
      (value) => value === "" || isCount(value, max),
      `Enter a whole number from 1 to ${max}.`,
    );

const countFields = {
  bucketRefillAt: countField(100),
  bucketTarget: countField(100),
  cadenceDays: countField(365),
};

const checkBucket = (
  { bucketRefillAt, bucketTarget }: { bucketRefillAt: string; bucketTarget: string },
  context: z.RefinementCtx,
) => {
  if ((bucketRefillAt === "") !== (bucketTarget === "")) {
    context.addIssue({
      code: "custom",
      message: "Set both bucket target and refill threshold, or leave both blank.",
      path: [bucketRefillAt === "" ? "bucketRefillAt" : "bucketTarget"],
    });
    return;
  }
  if (
    isCount(bucketRefillAt, 100) &&
    isCount(bucketTarget, 100) &&
    Number(bucketRefillAt) > Number(bucketTarget)
  ) {
    context.addIssue({
      code: "custom",
      message: `Refill threshold (${bucketRefillAt}) must be ≤ bucket target (${bucketTarget}).`,
      path: ["bucketRefillAt"],
    });
  }
};

export const autoPublishSchema = z
  .object({
    ...countFields,
    enabled: z.boolean(),
    language: z.enum(SiteLanguage),
    topicHints: z.string(),
  })
  .superRefine((value, context) => {
    if (value.enabled && value.cadenceDays === "") {
      context.addIssue({
        code: "custom",
        message: "Cadence is required when auto-publish is enabled.",
        path: ["cadenceDays"],
      });
    }
    checkBucket(value, context);
  });

export const networkDefaultsSchema = z
  .object({ ...countFields, overwrite: z.boolean() })
  .superRefine((value, context) => {
    if (value.cadenceDays === "" && value.bucketTarget === "" && value.bucketRefillAt === "") {
      context.addIssue({
        code: "custom",
        message: "Fill in at least one section (cadence or bucket).",
        path: ["cadenceDays"],
      });
    }
    checkBucket(value, context);
  });

export const newPostSchema = z.object({
  body: z.string().min(1, "Write the post body."),
  categories: z.string(),
  excerpt: z.string().max(300, "Keep the excerpt to 300 characters."),
  focusKeyword: z.string().max(80, "Keep the focus keyword to 80 characters."),
  niches: z.array(z.enum(Niche)),
  publish: z.boolean(),
  scheduledAt: z.string(),
  siteId: z.string().min(1, "Pick a site."),
  slug: z
    .string()
    .min(1, "Enter a slug.")
    .regex(POST_SLUG_PATTERN, "Use lowercase letters and numbers, separated by single hyphens."),
  tags: z.string(),
  title: z.string().min(1, "Enter a title.").max(160, "Keep the title to 160 characters."),
});
