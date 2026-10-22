"use client";

import { deployHookUrlSchema, siteDomainSchema } from "@repo/api-types/sites";
import { Niche, SiteLanguage } from "@repo/db/browser";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldLabel, FieldGroup } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { z } from "zod";

import { createSiteAction } from "../actions";

import { NicheToggleGroup } from "./niche-toggle-group";

const formSchema = z.object({
  domain: siteDomainSchema,
  isEnabled: z.boolean(),
  language: z.enum(SiteLanguage),
  niches: z.array(z.enum(Niche)),
  vercelDeployHookUrl: z
    .string()
    .refine(
      (value) => deployHookUrlSchema.safeParse(value).success,
      "Enter an HTTP(S) deploy hook URL or leave it blank.",
    ),
});
const defaultValues: z.input<typeof formSchema> = {
  domain: "",
  isEnabled: true,
  language: "PT",
  niches: [],
  vercelDeployHookUrl: "",
};

export const SiteCreateDialog = () => {
  const [open, setOpen] = useState(false);
  const ready = useClientReady();
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues,
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await createSiteAction(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      form.reset();
      router.push(`/dashboard/sites/${result.id}`);
      router.refresh();
    },
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger disabled={!ready} render={<Button>Add site</Button>} />
      <DialogContent className="max-h-(--layout-max-h-sheet-viewport) overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a site</DialogTitle>
          <DialogDescription>
            Connect an Astro site to your network. You can configure publishing after saving.
          </DialogDescription>
        </DialogHeader>
        <ClientReadyForm
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          ref={formRef}
        >
          <FieldGroup>
            <form.Field name="domain">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid || undefined}>
                  <FieldLabel htmlFor={`${id}-domain`}>Domain</FieldLabel>
                  <Input
                    aria-describedby={field.state.meta.isValid ? undefined : `${id}-domain-error`}
                    aria-invalid={!field.state.meta.isValid}
                    autoComplete="url"
                    id={`${id}-domain`}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="photo-blog.example"
                    value={field.state.value}
                  />
                  <FormFieldError errors={field.state.meta.errors} id={`${id}-domain-error`} />
                </Field>
              )}
            </form.Field>
            <form.Field name="language">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${id}-language`}>Content language</FieldLabel>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-base md:text-sm"
                    id={`${id}-language`}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(z.enum(SiteLanguage).parse(event.target.value));
                    }}
                    value={field.state.value}
                  >
                    <option value="PT">Português</option>
                    <option value="EN">English</option>
                    <option value="ES">Español</option>
                  </select>
                </Field>
              )}
            </form.Field>
            <form.Field name="niches">
              {(field) => (
                <Field>
                  <FieldLabel>Niches</FieldLabel>
                  <NicheToggleGroup
                    onChange={field.handleChange}
                    options={Object.values(Niche)}
                    value={field.state.value}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="vercelDeployHookUrl">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid || undefined}>
                  <FieldLabel htmlFor={`${id}-hook`}>Deploy hook URL (optional)</FieldLabel>
                  <Input
                    aria-describedby={field.state.meta.isValid ? undefined : `${id}-hook-error`}
                    aria-invalid={!field.state.meta.isValid}
                    autoComplete="off"
                    id={`${id}-hook`}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="https://api.vercel.com/v1/integrations/deploy/…"
                    type="url"
                    value={field.state.value}
                  />
                  <FormFieldError errors={field.state.meta.errors} id={`${id}-hook-error`} />
                </Field>
              )}
            </form.Field>
            {error !== null && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} type="submit">
                  {pending ? "Adding site…" : "Create site"}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </ClientReadyForm>
      </DialogContent>
    </Dialog>
  );
};
