import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerRequestSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(255, "Name must be 255 characters or fewer")
    // The form sends null for a blank name; API clients may leave the field out entirely.
    .nullish()
    .transform((name) => name || null),
  email,
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer"),
});

export const registerFormSchema = registerRequestSchema
  .extend({ confirm: z.string().min(1, "Confirm your password") })
  .refine((values) => values.password === values.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormValues = z.output<typeof registerFormSchema>;
