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
import { profileSchema } from "@/lib/form-schemas";

export const ProfileForm = ({ email, name }: { email: string; name: string }) => {
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const form = useForm({
    defaultValues: { name },
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
    validators: { onBlur: profileSchema, onChange: profileSchema },
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <p className="text-sm text-muted-foreground">Signed in as {email}</p>
            <form.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="account-name">Display name</FieldLabel>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0 ? "account-name-error" : undefined
                    }
                    autoComplete="name"
                    id="account-name"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    type="text"
                    value={field.state.value}
                  />
                  <FormFieldError errors={field.state.meta.errors} id="account-name-error" />
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
                  {pending ? "Saving…" : "Save profile"}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};
