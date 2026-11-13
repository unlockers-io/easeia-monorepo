import {
  POST_EXCERPT_MAX_LENGTH,
  POST_FOCUS_KEYWORD_MAX_LENGTH,
  POST_SLUG_PATTERN,
  POST_TITLE_MAX_LENGTH,
} from "@repo/api-types";
import { NAME_LENGTH, PASSWORD_LENGTH } from "@repo/auth/policy";
import {
  configIssues,
  networkDefaultsIssues,
  type Schedule,
  type ScheduleIssue,
} from "@repo/auto-publish/rules";
import { Niche, SiteLanguage } from "@repo/db/browser";
import { z } from "zod";

export const matching = (schema: z.ZodType, message: string) =>
  z.string().refine((value) => schema.safeParse(value).success, message);

const emailSchema = z.email("Invalid email address");

const passwordSchema = z
  .string()
  .min(PASSWORD_LENGTH.min, `Password must be at least ${PASSWORD_LENGTH.min} characters`)
  .max(PASSWORD_LENGTH.max, `Password must be at most ${PASSWORD_LENGTH.max} characters`);

const nameSchema = z
  .string()
  .trim()
  .min(NAME_LENGTH.min, `Name must be at least ${NAME_LENGTH.min} characters`)
  .max(NAME_LENGTH.max, `Name must be at most ${NAME_LENGTH.max} characters`);

const passwordsMatch = {
  message: "Passwords do not match",
  path: ["confirmPassword"],
};

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    confirmPassword: passwordSchema,
    email: emailSchema,
    name: nameSchema,
    password: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const recoverSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: passwordSchema,
    password: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const profileSchema = z.object({
  name: nameSchema,
});

export const changePasswordSchema = z
  .object({
    confirmPassword: z.string().min(PASSWORD_LENGTH.min, "Confirm your new password"),
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((value) => value.newPassword === value.confirmPassword, passwordsMatch);

type ScheduleFields = { bucketRefillAt: string; bucketTarget: string; cadenceDays: string };

const toCount = (value: string): number | null => (value === "" ? null : Number(value));

export const toSchedule = (value: ScheduleFields): Schedule => ({
  bucketRefillAt: toCount(value.bucketRefillAt),
  bucketTarget: toCount(value.bucketTarget),
  cadenceDays: toCount(value.cadenceDays),
});

const scheduleFields = {
  bucketRefillAt: z.string(),
  bucketTarget: z.string(),
  cadenceDays: z.string(),
};

const addIssues = (issues: ReadonlyArray<ScheduleIssue>, context: z.RefinementCtx) => {
  for (const { message, path } of issues) {
    context.addIssue({ code: "custom", message, path: [path] });
  }
};

export const autoPublishSchema = z
  .object({
    ...scheduleFields,
    enabled: z.boolean(),
    language: z.enum(SiteLanguage),
    topicHints: z.string(),
  })
  .superRefine((value, context) => {
    addIssues(configIssues({ ...toSchedule(value), autoPublishEnabled: value.enabled }), context);
  });

export const networkDefaultsSchema = z
  .object({ ...scheduleFields, overwrite: z.boolean() })
  .superRefine((value, context) => {
    addIssues(networkDefaultsIssues(toSchedule(value)), context);
  });

export const newPostSchema = z.object({
  body: z.string().min(1, "Write the post body."),
  categories: z.string(),
  excerpt: z
    .string()
    .max(POST_EXCERPT_MAX_LENGTH, `Keep the excerpt to ${POST_EXCERPT_MAX_LENGTH} characters.`),
  focusKeyword: z
    .string()
    .max(
      POST_FOCUS_KEYWORD_MAX_LENGTH,
      `Keep the focus keyword to ${POST_FOCUS_KEYWORD_MAX_LENGTH} characters.`,
    ),
  niches: z.array(z.enum(Niche)),
  publish: z.boolean(),
  scheduledAt: z.string(),
  siteId: z.string().min(1, "Pick a site."),
  slug: z
    .string()
    .min(1, "Enter a slug.")
    .regex(POST_SLUG_PATTERN, "Use lowercase letters and numbers, separated by single hyphens."),
  tags: z.string(),
  title: z
    .string()
    .min(1, "Enter a title.")
    .max(POST_TITLE_MAX_LENGTH, `Keep the title to ${POST_TITLE_MAX_LENGTH} characters.`),
});
