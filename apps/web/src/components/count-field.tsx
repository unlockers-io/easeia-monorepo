import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

type Props = {
  descriptionId: string;
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
  };
  id: string;
  label: string;
  placeholder: string;
};

const CountField = ({ descriptionId, field, id, label, placeholder }: Props) => {
  const isInvalid = !field.state.meta.isValid;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-describedby={isInvalid ? `${descriptionId} ${errorId}` : descriptionId}
        aria-invalid={isInvalid}
        autoComplete="off"
        id={id}
        inputMode="numeric"
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        placeholder={placeholder}
        value={field.state.value}
      />
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </div>
  );
};

export { CountField };
