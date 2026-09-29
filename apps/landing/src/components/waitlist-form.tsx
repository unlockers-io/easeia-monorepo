"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

import { apiUrl } from "@/lib/urls";

const emailSchema = z.string().trim().pipe(z.email("Enter a valid email address."));
const errorSchema = z.object({ error: z.object({ message: z.string() }) });

const WaitlistForm = () => {
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "", website: "" },
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
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="email" validators={{ onBlur: emailSchema, onChange: emailSchema }}>
          {(field) => {
            const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="waitlist-email">Email address</FieldLabel>
                <Input
                  aria-describedby="waitlist-privacy"
                  aria-invalid={invalid}
                  autoComplete="email"
                  disabled={submitting}
                  id="waitlist-email"
                  name="email"
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="you@example.com"
                  required
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
        {error !== null && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
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
    </form>
  );
};
export { WaitlistForm };
