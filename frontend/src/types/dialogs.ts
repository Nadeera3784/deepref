import type { ReactNode } from "react";

export type RenameDialogProps = {
  open: boolean;
  initialValue: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
};

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  onConfirm: () => Promise<unknown>;
  confirmLabel?: string;
  pendingLabel?: string;
};
