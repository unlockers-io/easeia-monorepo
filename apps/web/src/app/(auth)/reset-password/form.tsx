"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthPasswordField } from "@/components/auth-password-field";
import { authClient, authFailureMessage } from "@/lib/auth-client";
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
      const result = await authClient
        .resetPassword({
          newPassword: value.password,
          token,
        })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        setError(result);
        return;
      }
      if (result.error) {
        setError(result.error.message ?? "Failed to reset password");
        return;
      }
      push("/login?message=password-reset-success");
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
                description="At least 12 characters."
                disabled={isLoading}
                field={field}
                label="New password"
              />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <AuthPasswordField disabled={isLoading} field={field} label="Confirm password" />
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
