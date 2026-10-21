import type { z } from "zod";

import type { loginSchema, registerFormSchema } from "@/lib/validation/auth";
import type { Role } from "@/types/api";

export type TokenClaims = { sub: string; role: Role; exp: number };

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormValues = z.output<typeof registerFormSchema>;
