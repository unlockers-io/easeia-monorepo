"use client";

import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import type { ReactNode } from "react";

import { fieldAria } from "@/lib/field-aria";

export type SiteOption = { domain: string; id: string };

type Props = {
  description?: ReactNode;
  field: {
    handleChange: (value: string) => void;
    name: string;
    state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
  };
  sites: ReadonlyArray<SiteOption>;
};

export const SitePicker = ({ description, field, sites }: Props) => {
  const isInvalid = !field.state.meta.isValid;

  const { describedBy, descriptionId, errorId } = fieldAria(
    field.name,
    description !== undefined,
    isInvalid,
  );

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>Site</FieldLabel>
      <Select
        items={sites.map((site) => ({ label: site.domain, value: site.id }))}
        onValueChange={(next: string | null) => {
          field.handleChange(next ?? "");
        }}
        value={field.state.value}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={isInvalid}
          aria-required
          className="w-full"
          id={field.name}
        >
          <SelectValue placeholder="Pick a site" />
        </SelectTrigger>
        <SelectContent>
          {sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.domain}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description === undefined ? null : (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </Field>
  );
};
