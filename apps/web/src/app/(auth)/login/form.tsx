"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm, useSelector } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useState } from "react";
import { toast } from "sonner";

import { authClient, authFailureMessage } from "@/lib/auth-client";
import { loginSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const SignUpLinkFallback = () => (
  <Link className="text-foreground underline underline-offset-4" href="/register">
    Sign up
  </Link>
);

const SignUpLink = ({ searchParams }: Props) => {
  const { from } = use(searchParams);
  const safeTo = safeRedirectPath(from);

  return (
    <Link
      className="text-foreground underline underline-offset-4"
      href={safeTo === "/dashboard" ? "/register" : `/register?from=${encodeURIComponent(safeTo)}`}
    >
      Sign up
    </Link>
  );
};

const LoginForm = ({
  mailConfigured,
  searchParams,
  signupOpen,
}: Props & { mailConfigured: boolean; signupOpen: boolean }) => {
  const { push, refresh } = useRouter();
  const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setShowUnverifiedNotice(false);
      const result = await authClient.signIn
        .email({ email: value.email, password: value.password })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        toast.error(result);
        return;
      }
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setShowUnverifiedNotice(true);
          return;
        }
        toast.error(result.error.message ?? "Invalid credentials");
        return;
      }
      const { from } = await searchParams;
      push(safeRedirectPath(from));
      refresh();
    },
    validators: { onSubmit: loginSchema },
  });

  const isLoading = useSelector(form.store, (s) => s.isSubmitting);

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

        <form.Field name="password">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {mailConfigured && (
                    <Link
                      className="ml-auto text-sm text-foreground underline underline-offset-4"
                      href="/recover"
                    >
                      Forgot your password?
                    </Link>
                  )}
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
              <Suspense fallback={<SignUpLinkFallback />}>
                <SignUpLink searchParams={searchParams} />
              </Suspense>
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
};

export default LoginForm;
