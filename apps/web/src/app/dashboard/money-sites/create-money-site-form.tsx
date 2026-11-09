"use client";

import {
  MONEY_SITE_NAME_MAX_LENGTH,
  MONEY_SITE_PATH_PREFIX_MAX_LENGTH,
  moneySiteCreateSchema,
} from "@repo/api-types";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { matching } from "@/lib/form-schemas";

import { createMoneySiteAction } from "./actions";

const createFields = moneySiteCreateSchema.shape;

const formSchema = z.object({
  contentPathPrefix: z
    .string()
    .trim()
    .max(
      MONEY_SITE_PATH_PREFIX_MAX_LENGTH,
      `Keep the prefix to ${MONEY_SITE_PATH_PREFIX_MAX_LENGTH} characters.`,
    ),
  domain: createFields.domain,
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(MONEY_SITE_NAME_MAX_LENGTH, `Keep the name to ${MONEY_SITE_NAME_MAX_LENGTH} characters.`),
  sitemapUrl: matching(createFields.sitemapUrl, "Enter an HTTP(S) sitemap URL."),
});

const fields = [
  ["name", "Name", "Name (e.g., Acme Studios)"],
  ["domain", "Domain", "Domain (e.g., acmestudios.example)"],
  ["sitemapUrl", "Sitemap URL", "Sitemap URL"],
  ["contentPathPrefix", "Content path prefix", "Content path prefix (optional, e.g., /spaces/)"],
] as const;

export const CreateMoneySiteForm = () => {
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { contentPathPrefix: "", domain: "", name: "", sitemapUrl: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ formApi, value }) => {
      setError(null);

      const result = await createMoneySiteAction({
        contentPathPrefix: value.contentPathPrefix || undefined,
        domain: value.domain,
        name: value.name,
        sitemapUrl: value.sitemapUrl,
      });

      if (!result.ok) {
        setError(result.error);

        return;
      }

      formApi.reset();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  return (
    <ClientReadyForm
      className="mt-6 grid gap-2 rounded border p-4"
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="text-sm font-medium">Add money site</div>
      <FormAlert message={error} />
      {fields.map(([name, label, placeholder]) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <>
              <Input
                aria-describedby={field.state.meta.isValid ? undefined : `money-site-${name}-error`}
                aria-invalid={!field.state.meta.isValid}
                aria-label={label}
                aria-required={name !== "contentPathPrefix"}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder={placeholder}
                value={field.state.value}
              />
              <FormFieldError errors={field.state.meta.errors} id={`money-site-${name}-error`} />
            </>
          )}
        </form.Field>
      ))}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isCreating) => (
          <Button disabled={isCreating} type="submit">
            Add
          </Button>
        )}
      </form.Subscribe>
    </ClientReadyForm>
  );
};
