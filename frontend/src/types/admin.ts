import type { AdminUser } from "@/types/api";

export type UserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUser | null;
};
