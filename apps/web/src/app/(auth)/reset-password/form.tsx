"use client";

import { PASSWORD_LENGTH } from "@repo/auth/policy";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthPasswordField } from "@/components/auth-password-field";
import { authClient, runAuth } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/form-schemas";

const ResetPasswordForm = ({ token }: { token: string }) => {
  const { push } = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      const result = await runAuth(
        authClient.resetPassword({ newPassword: value.password, token }),
        "Failed to reset password",
      );

      if (!result.ok) {
        setError(result.error);

        return;
      }

      toast.success("Password reset. Sign in with your new password.");
      push("/login");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: resetPasswordSchema },
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
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="password">
            {(field) => (
              <AuthPasswordField
                autoComplete="new-password"
                description={`At least ${PASSWORD_LENGTH.min} characters.`}
                disabled={isLoading}
                field={field}
                label="New password"
              />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <AuthPasswordField
                autoComplete="new-password"
                disabled={isLoading}
                field={field}
                label="Confirm password"
              />
            )}
          </form.Field>
        </div>

        <Field>
          <Button disabled={isLoading} type="submit">
            {isLoading ? "Resetting..." : "Reset password"}
          </Button>
          <FieldDescription className="text-center">
            Back to{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </ClientReadyForm>
  );
};

export default ResetPasswordForm;
