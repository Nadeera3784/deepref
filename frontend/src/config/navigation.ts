import { BarChart3, FileText, MessageSquarePlus, Users } from "lucide-react";

import type { NavItem } from "@/types";

export const NAV: NavItem[] = [
  { href: "/chat", label: "New chat", icon: MessageSquarePlus, exact: true },
  { href: "/documents", label: "Documents", icon: FileText },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Analytics", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
];
