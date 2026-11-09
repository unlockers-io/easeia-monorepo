"use client";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";

import { fieldAria } from "@/lib/field-aria";

import { updateSiteAuthorAction } from "../actions";

import { authorFormSchema } from "./patches";

export type AuthorFormProps = {
  defaultBio: string | null;
  defaultName: string | null;
  defaultPhotoUrl: string | null;
  defaultUrl: string | null;
  siteId: string;
};

export const AuthorCard = (props: AuthorFormProps) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>Author</h2>
      </CardTitle>
      <CardDescription>
        E-E-A-T identity for this site. The build API attaches it to every post so the theme can
        render a byline, author page, and schema.org Person markup.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <AuthorForm {...props} />
    </CardContent>
  </Card>
);

type AuthorFieldApi = {
  handleBlur: () => void;
  handleChange: (value: string) => void;
  name: string;
  state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
};

const AuthorField = ({
  field,
  label,
  multiline = false,
  placeholder,
  siteId,
}: {
  field: AuthorFieldApi;
  label: string;
  multiline?: boolean;
  placeholder: string;
  siteId: string;
}) => {
  const isInvalid = !field.state.meta.isValid;
  const id = `${field.name}-${siteId}`;
  const { describedBy, errorId } = fieldAria(id, false, isInvalid);

  const props = {
    "aria-describedby": describedBy,
    "aria-invalid": isInvalid,
    id,
    onBlur: field.handleBlur,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      field.handleChange(event.target.value);
    },
    placeholder,
    value: field.state.value,
  };

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? <Textarea {...props} rows={3} /> : <Input {...props} />}
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </Field>
  );
};

const AuthorForm = (props: AuthorFormProps) => {
  const { siteId } = props;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      authorBio: props.defaultBio ?? "",
      authorName: props.defaultName ?? "",
      authorPhotoUrl: props.defaultPhotoUrl ?? "",
      authorUrl: props.defaultUrl ?? "",
    },
    listeners: {
      onChange: () => {
        setError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await updateSiteAuthorAction(siteId, value);

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setSavedAt(new Date());
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: authorFormSchema },
  });

  return (
    <ClientReadyForm
      className="flex flex-col gap-3"
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormAlert message={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form.Field name="authorName">
          {(field) => (
            <AuthorField
              field={field}
              label="Name"
              placeholder="e.g. Marina Duarte"
              siteId={siteId}
            />
          )}
        </form.Field>
        <form.Field name="authorUrl">
          {(field) => (
            <AuthorField
              field={field}
              label="Profile URL"
              placeholder="https://instagram.com/…"
              siteId={siteId}
            />
          )}
        </form.Field>
      </div>
      <form.Field name="authorPhotoUrl">
        {(field) => (
          <AuthorField
            field={field}
            label="Photo URL"
            placeholder="https://img.easeia.com/…"
            siteId={siteId}
          />
        )}
      </form.Field>
      <form.Field name="authorBio">
        {(field) => (
          <AuthorField
            field={field}
            label="Bio"
            multiline
            placeholder="One or two sentences of niche-relevant credentials."
            siteId={siteId}
          />
        )}
      </form.Field>
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString("en-US")}. Changes reach the live site on its next build.`
            : "Leave the name blank to publish posts without a byline."}
        </p>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <Button disabled={pending} size="sm" type="submit">
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </ClientReadyForm>
  );
};
