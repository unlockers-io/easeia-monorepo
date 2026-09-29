"use client";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient, authFailureMessage } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/form-schemas";

export const PasswordForm = () => {
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const form = useForm({
    defaultValues: { confirmPassword: "", currentPassword: "", newPassword: "" },
    onSubmit: async ({ value }) => {
      setMessage(null);
      const result = await authClient
        .changePassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
          revokeOtherSessions: true,
        })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        setMessage(result);
        return;
      }
      if (result.error) {
        setMessage(result.error.message ?? "Could not change password.");
        return;
      }
      form.reset();
      setMessage("Password changed. Your other sessions have been signed out.");
      router.refresh();
    },
    validators: { onBlur: changePasswordSchema, onChange: changePasswordSchema },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Security</h2>
        </CardTitle>
        <CardDescription>
          Use at least 12 characters. Changing your password signs out your other sessions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="currentPassword">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="account-currentPassword">Current password</FieldLabel>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? "account-currentPassword-error"
                        : undefined
                    }
                    autoComplete="current-password"
                    id="account-currentPassword"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  <FormFieldError
                    errors={field.state.meta.errors}
                    id="account-currentPassword-error"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="newPassword">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="account-newPassword">New password</FieldLabel>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0 ? "account-newPassword-error" : undefined
                    }
                    autoComplete="new-password"
                    id="account-newPassword"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  <FormFieldError errors={field.state.meta.errors} id="account-newPassword-error" />
                </Field>
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="account-confirmPassword">Confirm new password</FieldLabel>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? "account-confirmPassword-error"
                        : undefined
                    }
                    autoComplete="new-password"
                    id="account-confirmPassword"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    type="password"
                    value={field.state.value}
                  />
                  <FormFieldError
                    errors={field.state.meta.errors}
                    id="account-confirmPassword-error"
                  />
                </Field>
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
        </form>
      </CardContent>
    </Card>
  );
};
