"use client";

import { POST_SLUG_PATTERN } from "@repo/api-types";
import { Niche } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { z } from "zod";

import { createPostAction } from "../../actions";
import { NicheToggleGroup } from "../../sites/niche-toggle-group";

const formSchema = z.object({
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

const emptyPost: z.input<typeof formSchema> = {
  body: "",
  categories: "",
  excerpt: "",
  focusKeyword: "",
  niches: [],
  publish: false,
  scheduledAt: "",
  siteId: "",
  slug: "",
  tags: "",
  title: "",
};

const splitCsv = (raw: string): Array<string> =>
  raw.split(",").flatMap((token) => {
    const trimmed = token.trim();
    return trimmed === "" ? [] : [trimmed];
  });

const optional = (value: string): string | undefined => (value === "" ? undefined : value);

type TextFieldProps = {
  description?: string;
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    name: string;
    state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
  };
  isRequired?: boolean;
  label: string;
  multiline?: boolean;
  placeholder?: string;
  type?: "datetime-local";
};

const TextField = ({
  description,
  field,
  isRequired,
  label,
  multiline,
  placeholder,
  type,
}: TextFieldProps) => {
  const isInvalid = !field.state.meta.isValid;
  const errorId = `${field.name}-error`;
  const descriptionId = `${field.name}-description`;
  const describedBy = [description === undefined ? null : descriptionId, isInvalid ? errorId : null]
    .filter((describer) => describer !== null)
    .join(" ");
  const control = {
    "aria-describedby": describedBy === "" ? undefined : describedBy,
    "aria-invalid": isInvalid,
    "aria-required": isRequired,
    id: field.name,
    onBlur: field.handleBlur,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      field.handleChange(event.target.value);
    },
    placeholder,
    value: field.state.value,
  };

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      {multiline === true ? (
        <div className="font-mono">
          <Textarea {...control} />
        </div>
      ) : (
        <Input {...control} type={type} />
      )}
      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </Field>
  );
};

const NICHE_OPTIONS = Object.values(Niche);

export const NewPostForm = ({
  sites,
}: {
  sites: ReadonlyArray<{ domain: string; id: string }>;
}) => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const ready = useClientReady();
  const form = useForm({
    defaultValues: { ...emptyPost, siteId: sites[0]?.id ?? "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const result = await createPostAction({
          body: value.body,
          categories: splitCsv(value.categories),
          excerpt: optional(value.excerpt),
          focusKeyword: optional(value.focusKeyword),
          niches: value.niches,
          publish: value.publish,
          scheduledAt: value.scheduledAt === "" ? undefined : new Date(value.scheduledAt),
          siteId: value.siteId,
          slug: value.slug,
          tags: splitCsv(value.tags),
          title: value.title,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/dashboard/posts/${result.id}`);
      } catch {
        setError("Could not save the post. Try again.");
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  return (
    <ClientReadyForm
      className="flex flex-col gap-6"
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormAlert message={error} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Target & content</h2>
          </CardTitle>
          <CardDescription>Where to publish, and what to publish.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <form.Field name="siteId">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid || undefined}>
                  <FieldLabel htmlFor="siteId">Site</FieldLabel>
                  <Select
                    onValueChange={(next: string | null) => {
                      field.handleChange(next ?? "");
                    }}
                    value={field.state.value}
                  >
                    <SelectTrigger
                      aria-describedby={field.state.meta.isValid ? undefined : "siteId-error"}
                      aria-invalid={!field.state.meta.isValid}
                      aria-required
                      id="siteId"
                    >
                      <SelectValue placeholder="Pick a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!field.state.meta.isValid && (
                    <FormFieldError errors={field.state.meta.errors} id="siteId-error" />
                  )}
                </Field>
              )}
            </form.Field>

            <div className="grid gap-5 sm:grid-cols-post-editor">
              <form.Field name="slug">
                {(field) => (
                  <TextField
                    description="Lowercase letters and numbers, separated by single hyphens."
                    field={field}
                    isRequired
                    label="Slug"
                    placeholder="kebab-case-only"
                  />
                )}
              </form.Field>
              <form.Field name="title">
                {(field) => (
                  <TextField
                    description="Up to 160 characters."
                    field={field}
                    isRequired
                    label="Title"
                  />
                )}
              </form.Field>
            </div>

            <form.Field name="body">
              {(field) => (
                <TextField
                  field={field}
                  isRequired
                  label="Body (Markdown)"
                  multiline
                  placeholder={"## Introduction\n\nWrite your post here…"}
                />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>SEO tracking</h2>
          </CardTitle>
          <CardDescription>
            Focus keyword feeds DataForSEO SERP rank tracking. Meta title/description are managed by
            your Astro site templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <form.Field name="focusKeyword">
                {(field) => (
                  <TextField
                    description="Up to 80 characters."
                    field={field}
                    label="Focus keyword"
                    placeholder="wedding photography"
                  />
                )}
              </form.Field>
              <form.Field name="excerpt">
                {(field) => (
                  <TextField
                    description="Up to 300 characters."
                    field={field}
                    label="Excerpt"
                    placeholder="Short summary"
                  />
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Taxonomy</h2>
          </CardTitle>
          <CardDescription>
            Categories and tags map per site. Niches drive cross-site link relevance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <form.Field name="categories">
                {(field) => (
                  <TextField field={field} label="Categories" placeholder="Photography, Wedding" />
                )}
              </form.Field>
              <form.Field name="tags">
                {(field) => (
                  <TextField field={field} label="Tags" placeholder="weddings, portraits" />
                )}
              </form.Field>
            </div>
            <Field>
              <FieldLabel>Niches</FieldLabel>
              <form.Field name="niches">
                {(field) => (
                  <NicheToggleGroup
                    onChange={field.handleChange}
                    options={NICHE_OPTIONS}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Publish</h2>
          </CardTitle>
          <CardDescription>
            Drafts stay in Easeia. Publishing pushes to Astro now, or at the scheduled time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <FieldLabel htmlFor="publish">Publish now / on schedule</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Skips Drafts; goes straight to Scheduled, then the worker pushes.
                </p>
              </div>
              <form.Field name="publish">
                {(field) => (
                  <Switch
                    checked={field.state.value}
                    disabled={!ready}
                    id="publish"
                    onCheckedChange={field.handleChange}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="scheduledAt">
              {(field) => (
                <TextField
                  description="Leave empty to publish immediately. Future timestamps queue with delay."
                  field={field}
                  label="Scheduled at (optional)"
                  type="datetime-local"
                />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </ClientReadyForm>
  );
};
