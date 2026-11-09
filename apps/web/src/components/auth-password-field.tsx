import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

import { fieldAria } from "@/lib/field-aria";

type Props = {
  autoComplete: "current-password" | "new-password";
  description?: string;
  disabled?: boolean;
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    name: string;
    state: {
      meta: { errors: Array<unknown>; isValid: boolean };
      value: string;
    };
  };
  label: string;
};

const AuthPasswordField = ({
  autoComplete,
  description,
  disabled = false,
  field,
  label,
}: Props) => {
  const isInvalid = !field.state.meta.isValid;

  const { describedBy, descriptionId, errorId } = fieldAria(
    field.name,
    description !== undefined,
    isInvalid,
  );

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-describedby={describedBy}
        aria-invalid={isInvalid}
        autoComplete={autoComplete}
        disabled={disabled}
        id={field.name}
        name={field.name}
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
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} role="alert" />}
    </Field>
  );
};

export { AuthPasswordField };
