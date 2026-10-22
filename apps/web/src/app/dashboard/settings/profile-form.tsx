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
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { authClient, authFailureMessage } from "@/lib/auth-client";
import { profileSchema } from "@/lib/form-schemas";

export const ProfileForm = ({ email, name }: { email: string; name: string }) => {
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: { name },
    listeners: {
      onChange: () => {
        setMessage(null);
      },
    },
    onSubmit: async ({ value }) => {
      setMessage(null);
      const result = await authClient.updateUser(value).catch(authFailureMessage);
      if (typeof result === "string") {
        setMessage(result);
        return;
      }
      if (result.error) {
        setMessage(result.error.message ?? "Could not update profile.");
        return;
      }
      setMessage("Profile saved.");
      router.refresh();
    },
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: profileSchema },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Profile</h2>
        </CardTitle>
        <CardDescription>Update the name shown in your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClientReadyForm
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          ref={formRef}
        >
          <FieldGroup>
            <p className="text-sm text-muted-foreground">Signed in as {email}</p>
            <form.Field name="name">
              {(field) => {
                const isInvalid = !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor="account-name">Display name</FieldLabel>
                    <Input
                      aria-describedby={
                        isInvalid
                          ? "account-name-description account-name-error"
                          : "account-name-description"
                      }
                      aria-invalid={isInvalid}
                      autoComplete="name"
                      id="account-name"
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      type="text"
                      value={field.state.value}
                    />
                    <FieldDescription id="account-name-description">
                      3 to 32 characters.
                    </FieldDescription>
                    {isInvalid && (
                      <FormFieldError errors={field.state.meta.errors} id="account-name-error" />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            {message !== null && (
              <p aria-live="polite" className="text-sm">
                {message}
              </p>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save profile"}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </ClientReadyForm>
      </CardContent>
    </Card>
  );
};
