"use client";

import { deployHookUrlSchema } from "@repo/api-types/sites";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import { Field, FieldLabel, FieldGroup } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { updateSitePublishingAction } from "./actions";

const urlInput = z
  .string()
  .refine(
    (value) => deployHookUrlSchema.safeParse(value).success,
    "Enter an HTTP(S) URL or leave it blank.",
  );

const formSchema = z.object({
  astroRepoUrl: urlInput,
  imageStyle: z.string().max(2000),
  vercelDeployHookUrl: urlInput,
  vercelProjectName: z.string().max(200),
});

const fields = [
  ["vercelDeployHookUrl", "Deploy hook URL"],
  ["vercelProjectName", "Project name"],
  ["astroRepoUrl", "Repository URL"],
  ["imageStyle", "Image style (optional)"],
] as const;

export const PublishingForm = ({
  site,
}: {
  site: {
    astroRepoUrl: string | null;
    hasDeployHook: boolean;
    id: string;
    imageStyle: string | null;
    vercelDeployHookUrl: string | null;
    vercelProjectName: string | null;
  };
}) => {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      astroRepoUrl: site.astroRepoUrl ?? "",
      imageStyle: site.imageStyle ?? "",
      vercelDeployHookUrl: site.vercelDeployHookUrl ?? "",
      vercelProjectName: site.vercelProjectName ?? "",
    },
    listeners: {
      onChange: () => {
        setError(null);
        setMessage(null);
      },
    },
    onSubmit: async ({ value }) => {
      const result = await updateSitePublishingAction(site.id, value);

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setMessage("Publishing settings saved.");
      router.refresh();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });

  return (
    <Card id="publishing">
      <CardHeader>
        <CardTitle>
          <h2>Publishing</h2>
        </CardTitle>
        <CardDescription>
          {site.hasDeployHook ? "Deploy hook set" : "No deploy hook: publishing is blocked"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ClientReadyForm
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <FormAlert message={error} />
            {fields.map(([name, label]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid || undefined}>
                    <FieldLabel htmlFor={`${site.id}-${name}`}>{label}</FieldLabel>
                    <Input
                      aria-describedby={
                        field.state.meta.isValid ? undefined : `${site.id}-${name}-error`
                      }
                      aria-invalid={!field.state.meta.isValid}
                      autoComplete="off"
                      id={`${site.id}-${name}`}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      value={field.state.value}
                    />
                    <FormFieldError
                      errors={field.state.meta.errors}
                      id={`${site.id}-${name}-error`}
                    />
                  </Field>
                )}
              </form.Field>
            ))}
            <p className="text-sm text-muted-foreground">
              Easeia calls the deploy hook after publishing to rebuild your Astro site. Use a hook
              from your hosting provider.
            </p>
            {message !== null && (
              <p aria-live="polite" className="text-sm">
                {message}
              </p>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save publishing settings"}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </ClientReadyForm>
      </CardContent>
    </Card>
  );
};
