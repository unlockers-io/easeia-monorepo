"use client";

import { PASSWORD_MIN_LENGTH } from "@repo/auth/limits";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import { FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthPasswordField } from "@/components/auth-password-field";
import { authClient, runAuth } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/form-schemas";

export const PasswordForm = () => {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm({
    defaultValues: { confirmPassword: "", currentPassword: "", newPassword: "" },
    listeners: {
      onChange: () => {
        setError(null);
        setMessage(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setMessage(null);

      const result = await runAuth(
        authClient.changePassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
          revokeOtherSessions: true,
        }),
        "Could not change password.",
      );

      if (!result.ok) {
        setError(result.error);

        return;
      }

      form.reset();
      setMessage("Password changed. Your other sessions have been signed out.");
      router.refresh();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: changePasswordSchema },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Security</h2>
        </CardTitle>
        <CardDescription>Changing your password signs out your other sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClientReadyForm
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <FormAlert message={error} />
            <form.Field name="currentPassword">
              {(field) => (
                <AuthPasswordField
                  autoComplete="current-password"
                  field={field}
                  label="Current password"
                />
              )}
            </form.Field>
            <form.Field name="newPassword">
              {(field) => (
                <AuthPasswordField
                  autoComplete="new-password"
                  description={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                  field={field}
                  label="New password"
                />
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <AuthPasswordField
                  autoComplete="new-password"
                  field={field}
                  label="Confirm new password"
                />
              )}
            </form.Field>
            {message !== null && (
              <p aria-live="polite" className="text-sm">
                {message}
              </p>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Change password"}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </ClientReadyForm>
      </CardContent>
    </Card>
  );
};
