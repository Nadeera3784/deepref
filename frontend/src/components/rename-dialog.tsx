"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  initialValue: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
};

export function RenameDialog({ open, initialValue, onOpenChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
        </DialogHeader>
        {/* Keyed so the field resets to the current title each time the dialog opens. */}
        {open && (
          <RenameForm
            key={initialValue}
            initialValue={initialValue}
            onCancel={() => onOpenChange(false)}
            onSubmit={(value) => {
              onSubmit(value);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  initialValue,
  onCancel,
  onSubmit,
}: {
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="grid gap-4"
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} autoFocus />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!value.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
