"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, json } from "@/lib/api";
import type { AdminUser, Role } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this user; omit to create a new one. */
  user?: AdminUser | null;
};

export function UserDialog({ open, onOpenChange, user }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {user ? user.email : "Create an account and share the password with its owner."}
          </DialogDescription>
        </DialogHeader>
        {open && <UserForm key={user?.id ?? "new"} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ user, onDone }: { user?: AdminUser | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user?.role ?? "user");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      user
        ? api<AdminUser>(`/admin/users/${user.id}`, { method: "PATCH", body: json(body) })
        : api<AdminUser>("/admin/users", { method: "POST", body: json(body) }),
    onSuccess: () => {
      toast.success(user ? "User updated" : "User created");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const body: Record<string, unknown> = {
      full_name: String(form.get("full_name") ?? "").trim() || null,
      role,
      is_active: isActive,
    };
    if (!user) body.email = form.get("email");
    if (password) body.password = password;
    save.mutate(body);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <FieldGroup>
        {!user && (
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" required />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="full_name">Name</FieldLabel>
          <Input id="full_name" name="full_name" defaultValue={user?.full_name ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{user ? "New password" : "Password"}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required={!user}
          />
          {user && <FieldDescription>Leave blank to keep the current password.</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal">
          <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          <FieldLabel htmlFor="is_active">Active</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {user ? "Save changes" : "Create user"}
        </Button>
      </DialogFooter>
    </form>
  );
}
