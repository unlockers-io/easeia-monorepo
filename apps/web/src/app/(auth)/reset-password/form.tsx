"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldGroup } from "@repo/ui/components/field";
import { useForm, useSelector } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AuthPasswordField } from "@/components/auth-password-field";
import { authClient, authFailureMessage } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/form-schemas";

const ResetPasswordForm = ({ token }: { token: string }) => {
  const { push } = useRouter();

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      const result = await authClient
        .resetPassword({
          newPassword: value.password,
          token,
        })
        .catch(authFailureMessage);
      if (typeof result === "string") {
        toast.error(result);
        return;
      }
      if (result.error) {
        toast.error(result.error.message ?? "Failed to reset password");
        return;
      }
      push("/login?message=password-reset-success");
    },
    validators: { onSubmit: resetPasswordSchema },
  });

  const isLoading = useSelector(form.store, (s) => s.isSubmitting);

  return (
    <form
      action={async () => {
        await form.handleSubmit();
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="password">
            {(field) => (
              <AuthPasswordField disabled={isLoading} field={field} label="New password" />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <AuthPasswordField disabled={isLoading} field={field} label="Confirm password" />
            )}
          </form.Field>
        </div>

        <Field>
          <Button disabled={isLoading} type="submit">
            {isLoading ? "Resetting..." : "Reset password"}
          </Button>
          <FieldDescription className="text-center">
            Back to{" "}
            <Link className="text-foreground underline underline-offset-4" href="/login">
              sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default ResetPasswordForm;
