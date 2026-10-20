"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api, json } from "@/lib/api";
import type { User } from "@/lib/types";

export function ProfileForm() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (full_name: string) =>
      api<User>("/users/me", { method: "PATCH", body: json({ full_name: full_name || null }) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(String(new FormData(e.currentTarget).get("full_name") ?? "").trim());
        }}
        className="contents"
      >
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How your name appears in DeepRef.</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" value={user.email} disabled />
              </Field>
              <Field>
                <FieldLabel htmlFor="full_name">Name</FieldLabel>
                <Input id="full_name" name="full_name" defaultValue={user.full_name ?? ""} />
              </Field>
            </FieldGroup>
          ) : (
            <Skeleton className="h-32" />
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!user || save.isPending}>
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const change = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api<void>("/users/me/password", { method: "POST", body: json(body) }),
    onSuccess: () => toast.success("Password changed"),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formElement = e.currentTarget;
          const form = new FormData(formElement);
          const new_password = String(form.get("new_password"));
          if (new_password !== form.get("confirm")) {
            toast.error("New passwords do not match");
            return;
          }
          change.mutate(
            { current_password: String(form.get("current_password")), new_password },
            { onSuccess: () => formElement.reset() },
          );
        }}
        className="contents"
      >
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current_password">Current password</FieldLabel>
              <Input
                id="current_password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new_password">New password</FieldLabel>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={change.isPending}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
