"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { apiUrl } from "@/lib/urls";

const formSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  website: z.string(),
});
const errorSchema = z.object({ error: z.object({ message: z.string() }) });

const WaitlistForm = () => {
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "", website: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const response = await fetch(apiUrl("/api/waitlist"), {
          body: JSON.stringify({ ...value, source: "landing" }),
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          const parsed = errorSchema.safeParse(await response.json());
          setError(parsed.data?.error.message ?? "We could not save your email. Please try again.");
          return;
        }
        setStatus("success");
      } catch {
        setError("Could not reach the waitlist. Check your connection and try again.");
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
  });
  const submitting = useSelector(form.store, (state) => state.isSubmitting);

  if (status === "success") {
    return (
      <output aria-live="polite" className="block border-t border-foreground py-6">
        <span className="block text-xl font-bold">You’re on the list.</span>
        <span className="mt-2 block text-muted-foreground">
          We’ll email you when Cloud is ready. No payment is required.
        </span>
      </output>
    );
  }
  return (
    <ClientReadyForm
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FormAlert message={error} />
        <form.Field name="email">
          {(field) => {
            const invalid = !field.state.meta.isValid;
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="waitlist-email">Email address</FieldLabel>
                <Input
                  aria-describedby={
                    invalid ? "waitlist-email-error waitlist-privacy" : "waitlist-privacy"
                  }
                  aria-invalid={invalid}
                  aria-required
                  autoComplete="email"
                  disabled={submitting}
                  id="waitlist-email"
                  name="email"
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="you@example.com"
                  type="email"
                  value={field.state.value}
                />
                {invalid && (
                  <FormFieldError errors={field.state.meta.errors} id="waitlist-email-error" />
                )}
              </Field>
            );
          }}
        </form.Field>
        <div aria-hidden="true" hidden>
          <form.Field name="website">
            {(field) => (
              <input
                aria-label="Leave this field empty"
                autoComplete="off"
                name="website"
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                tabIndex={-1}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <Button aria-busy={submitting} disabled={submitting} size="lg" type="submit">
          {submitting ? "Joining…" : "Join the cloud waitlist"}
        </Button>
        <p className="text-sm text-muted-foreground" id="waitlist-privacy">
          Your email is used for Cloud launch updates.{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            Privacy policy
          </Link>
        </p>
      </FieldGroup>
    </ClientReadyForm>
  );
};
export { WaitlistForm };
