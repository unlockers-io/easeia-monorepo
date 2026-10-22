"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthPasswordField } from "@/components/auth-password-field";
import { authClient, authFailureMessage } from "@/lib/auth-client";
import { registerSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const SignInLinkFallback = () => (
  <Link className="text-foreground underline underline-offset-4" href="/login">
    Sign in
  </Link>
);

const SignInLink = ({ searchParams }: Props) => {
  const { from } = use(searchParams);
  const safeTo = safeRedirectPath(from);

  return (
    <Link
      className="text-foreground underline underline-offset-4"
      href={safeTo === "/dashboard" ? "/login" : `/login?from=${encodeURIComponent(safeTo)}`}
    >
      Sign in
    </Link>
  );
};

const RegisterForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", email: "", name: "", password: "" },
    onSubmit: async ({ value }) => {
      const { from } = await searchParams;
      const safeTo = safeRedirectPath(from);
      const result = await authClient.signUp
        .email({
          callbackURL: safeTo,
          email: value.email,
          name: value.name,
          password: value.password,
        })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        toast.error(result);
        return;
      }
      if (result.error) {
        toast.error(result.error.message ?? "Failed to register");
        return;
      }
      if (result.data.token === null || result.data.token === "") {
        setSentToEmail(value.email);
        return;
      }
      push(safeTo);
      refresh();
    },
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      ref={formRef}
    >
      <FieldGroup>
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
                <FieldDescription id="name-description">3 to 32 characters.</FieldDescription>
                {isInvalid && <FormFieldError errors={field.state.meta.errors} id="name-error" />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => {
            const isInvalid = !field.state.meta.isValid;
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

        <div className="grid grid-cols-2 gap-4">
          <form.Field name="password">
            {(field) => (
              <AuthPasswordField
                description="At least 12 characters."
                disabled={isLoading}
                field={field}
                label="Password"
              />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <AuthPasswordField disabled={isLoading} field={field} label="Confirm Password" />
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
            <Suspense fallback={<SignInLinkFallback />}>
              <SignInLink searchParams={searchParams} />
            </Suspense>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </ClientReadyForm>
  );
};

export default RegisterForm;
