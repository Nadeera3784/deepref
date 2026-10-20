"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormInput } from "@/components/form/form-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api";
import {
  type RegisterFormInput,
  type RegisterFormValues,
  registerFormSchema,
} from "@/lib/validation/auth";

export function RegisterForm() {
  const router = useRouter();
  const form = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm: "" },
    mode: "onTouched",
  });
  const { isSubmitting, errors } = form.formState;

  async function onSubmit({ full_name, email, password }: RegisterFormValues) {
    const account = { full_name, email, password };
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    if (!response.ok) {
      const message = await errorMessage(response);
      if (response.status === 409) {
        form.setError("email", { message }, { shouldFocus: true });
      } else {
        form.setError("root.server", { message });
      }
      return;
    }

    // Sign straight in with the new credentials.
    const login = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    if (!login.ok) {
      toast.success("Account created. Please sign in.");
      router.replace("/login");
      return;
    }
    router.replace("/chat");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Upload PDFs and ask questions about them</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormInput
              control={form.control}
              name="full_name"
              label="Name"
              autoComplete="name"
              autoFocus
            />
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
            />
            <FormInput
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              description="At least 8 characters."
            />
            <FormInput
              control={form.control}
              name="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
            />
            {errors.root?.server && <FieldError>{errors.root.server.message}</FieldError>}
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner />} Create account
              </Button>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/login">Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
