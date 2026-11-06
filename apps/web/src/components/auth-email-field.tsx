import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

type Props = {
  disabled: boolean;
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    name: string;
    state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
  };
};

export const AuthEmailField = ({ disabled, field }: Props) => {
  const isInvalid = !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input
        aria-describedby={isInvalid ? "email-error" : undefined}
        aria-invalid={isInvalid}
        aria-required
        autoComplete="email"
        disabled={disabled}
        id="email"
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        placeholder="you@example.com"
        type="email"
        value={field.state.value}
      />
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id="email-error" />}
    </Field>
  );
};
