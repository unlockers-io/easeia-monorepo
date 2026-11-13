"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthEmailField } from "@/components/auth-email-field";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { authClient, runAuth } from "@/lib/auth-client";
import { loginSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const LoginForm = ({ searchParams, signupOpen }: Props & { signupOpen: boolean }) => {
  const { push, refresh } = useRouter();
  const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setShowUnverifiedNotice(false);

      const result = await runAuth(
        authClient.signIn.email({ email: value.email, password: value.password }),
        "Invalid credentials",
      );

      if (!result.ok) {
        if (result.code === "EMAIL_NOT_VERIFIED") {
          setShowUnverifiedNotice(true);

          return;
        }

        setError(result.error);

        return;
      }

      const { from } = await searchParams;
      push(safeRedirectPath(from));
      refresh();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: loginSchema },
  });

  const isLoading = useSelector(form.store, (s) => s.isSubmitting);

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
        <form.Field name="email">
          {(field) => <AuthEmailField disabled={isLoading} field={field} />}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const isInvalid = !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    className="ml-auto text-sm text-foreground underline underline-offset-4"
                    href="/recover"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  aria-describedby={isInvalid ? "password-error" : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="current-password"
                  disabled={isLoading}
                  id="password"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  type="password"
                  value={field.state.value}
                />
                {isInvalid && (
                  <FormFieldError errors={field.state.meta.errors} id="password-error" />
                )}
              </Field>
            );
          }}
        </form.Field>

        {showUnverifiedNotice && (
          <output aria-live="polite" className="block text-center text-sm">
            This email isn&apos;t verified yet. We just sent you a new link.
          </output>
        )}

        <Field>
          <Button aria-busy={isLoading} disabled={isLoading} type="submit">
            {isLoading && <Loader2 className="size-4 motion-safe:animate-spin" />}
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
          {signupOpen && (
            <FieldDescription className="text-center">
              Don&apos;t have an account?{" "}
              <AuthSwitchLink href="/register" searchParams={searchParams}>
                Sign up
              </AuthSwitchLink>
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </ClientReadyForm>
  );
};

export default LoginForm;
