"use client";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { createFormHook, createFormHookContexts, revalidateLogic } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { authClient, authFailureMessage } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/form-schemas";

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  description?: string;
  label: string;
};

const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

const PasswordField = ({ autoComplete, description, label }: PasswordFieldProps) => {
  const field = useFieldContext<string>();
  const isInvalid = !field.state.meta.isValid;
  const inputId = `account-${field.name}`;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;
  const describedBy = [description === undefined ? null : descriptionId, isInvalid ? errorId : null]
    .filter((describer) => describer !== null)
    .join(" ");

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        aria-describedby={describedBy === "" ? undefined : describedBy}
        aria-invalid={isInvalid}
        autoComplete={autoComplete}
        id={inputId}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        type="password"
        value={field.state.value}
      />
      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </Field>
  );
};

const { useAppForm } = createFormHook({
  fieldComponents: { PasswordField },
  fieldContext,
  formComponents: {},
  formContext,
});

export const PasswordForm = () => {
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useAppForm({
    defaultValues: { confirmPassword: "", currentPassword: "", newPassword: "" },
    listeners: {
      onChange: () => {
        setMessage(null);
      },
    },
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
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
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
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          ref={formRef}
        >
          <FieldGroup>
            <form.AppField name="currentPassword">
              {(field) => (
                <field.PasswordField autoComplete="current-password" label="Current password" />
              )}
            </form.AppField>
            <form.AppField name="newPassword">
              {(field) => (
                <field.PasswordField
                  autoComplete="new-password"
                  description="At least 12 characters."
                  label="New password"
                />
              )}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {(field) => (
                <field.PasswordField autoComplete="new-password" label="Confirm new password" />
              )}
            </form.AppField>
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
