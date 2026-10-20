"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormInput } from "@/components/form/form-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api";
import { type LoginValues, loginSchema } from "@/lib/validation/auth";

/** Only allow same-site relative redirects after login. */
function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/chat";
}

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const { isSubmitting, errors } = form.formState;

  async function onSubmit(values: LoginValues) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      form.setError("root.server", { message: await errorMessage(response) });
      // Don't leave a rejected password in the field.
      form.resetField("password");
      form.setFocus("password");
      return;
    }
    router.replace(safeNextPath());
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your knowledge base</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
            />
            <FormInput
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            {errors.root?.server && <FieldError>{errors.root.server.message}</FieldError>}
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner />} Sign in
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account? <Link href="/register">Sign up</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
