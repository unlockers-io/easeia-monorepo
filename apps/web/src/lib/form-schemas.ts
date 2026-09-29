import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const registerSchema = z.object({
  confirmPassword: z.string().min(12, "Password must be at least 12 characters"),
  email: z.email("Invalid email address"),
  name: z.string().min(3, "Name must be at least 3 characters").max(32),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const recoverSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  confirmPassword: z.string().min(12, "Password must be at least 12 characters"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(32),
});
export const changePasswordSchema = z
  .object({
    confirmPassword: z.string().min(12, "Confirm your new password"),
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
