"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { authClient, authFailureMessage } from "@/lib/auth-client";
import { recoverSchema } from "@/lib/form-schemas";

const RecoverForm = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      const result = await authClient
        .requestPasswordReset({
          email: value.email,
          redirectTo: `${window.location.origin}/reset-password`,
        })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        toast.error(result);
        return;
      }
      if (result.error) {
        toast.error(result.error.message ?? "Failed to send password reset email");
        return;
      }
      setSubmittedEmail(value.email);
    },
    validators: { onSubmit: recoverSchema },
  });

  const isLoading = useSelector(form.store, (s) => s.isSubmitting);

  if (submittedEmail !== null && submittedEmail !== "") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{submittedEmail}</span> matches an
          account, we&apos;ve sent a link to reset your password.
        </p>
        <p className="text-sm text-muted-foreground">
          Back to{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="email">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "email-error" : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="email"
                  disabled={isLoading}
                  id="email"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="you@example.com"
                  type="email"
                  value={field.state.value}
                />
                {isInvalid && <FormFieldError errors={field.state.meta.errors} id="email-error" />}
              </Field>
            );
          }}
        </form.Field>

        <Field>
          <Button disabled={isLoading} type="submit">
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
          <FieldDescription className="text-center">
            Remembered your password?{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default RecoverForm;
