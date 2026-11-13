"use client";

import { NAME_LENGTH, PASSWORD_LENGTH } from "@repo/auth/policy";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AuthEmailField } from "@/components/auth-email-field";
import { AuthPasswordField } from "@/components/auth-password-field";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { authClient, runAuth } from "@/lib/auth-client";
import { registerSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const RegisterForm = ({ searchParams }: Props) => {
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", email: "", name: "", password: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      const { from } = await searchParams;

      const result = await runAuth(
        authClient.signUp.email({
          callbackURL: safeRedirectPath(from),
          email: value.email,
          name: value.name,
          password: value.password,
        }),
        "Failed to register",
      );

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setSentToEmail(value.email);
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: registerSchema },
  });

  const isLoading = useSelector(form.store, (s) => s.isSubmitting);

  if (sentToEmail !== null && sentToEmail !== "") {
    return (
      <output aria-live="polite" className="block space-y-1 text-center">
        <span className="block font-medium">Check your email</span>
        <span className="block text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium">{sentToEmail}</span>. Click
          it to verify your account and sign in.
        </span>
      </output>
    );
  }

  return (
    <ClientReadyForm
      id={form.formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FormAlert message={error} />
        <form.Field name="name">
          {(field) => {
            const isInvalid = !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  aria-describedby={isInvalid ? "name-description name-error" : "name-description"}
                  aria-invalid={isInvalid}
                  autoComplete="name"
                  disabled={isLoading}
                  id="name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="John Doe"
                  value={field.state.value}
                />
                <FieldDescription id="name-description">
                  {NAME_LENGTH.min} to {NAME_LENGTH.max} characters.
                </FieldDescription>
                {isInvalid && <FormFieldError errors={field.state.meta.errors} id="name-error" />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => <AuthEmailField disabled={isLoading} field={field} />}
        </form.Field>

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="password">
            {(field) => (
              <AuthPasswordField
                autoComplete="new-password"
                description={`At least ${PASSWORD_LENGTH.min} characters.`}
                disabled={isLoading}
                field={field}
                label="Password"
              />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <AuthPasswordField
                autoComplete="new-password"
                disabled={isLoading}
                field={field}
                label="Confirm Password"
              />
            )}
          </form.Field>
        </div>

        <Field>
          <Button aria-busy={isLoading} disabled={isLoading} type="submit">
            {isLoading && <Loader2 className="size-4 motion-safe:animate-spin" />}
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <AuthSwitchLink href="/login" searchParams={searchParams}>
              Sign in
            </AuthSwitchLink>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </ClientReadyForm>
  );
};

export default RegisterForm;
