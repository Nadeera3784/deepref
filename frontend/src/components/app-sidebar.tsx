"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Logo } from "@/components/logo";
import { NavUser } from "@/components/nav-user";
import { RenameDialog } from "@/components/rename-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ADMIN_NAV, NAV } from "@/config/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api, json } from "@/lib/api";
import { queries } from "@/lib/queries";
import type { Conversation, NavItem } from "@/types";

function NavItems({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            tooltip={item.label}
            isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function ChatHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(queries.conversations());
  const [filter, setFilter] = useState("");
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  const conversations = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const items = data?.items ?? [];
    return term ? items.filter((c) => c.title.toLowerCase().includes(term)) : items;
  }, [data, filter]);

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api<Conversation>(`/conversations/${id}`, { method: "PATCH", body: json({ title }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/conversations/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (pathname === `/chat/${id}`) router.push("/chat");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>History</SidebarGroupLabel>
      <div className="relative mb-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <SidebarInput
          placeholder="Search chats"
          className="pl-8"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <SidebarGroupContent>
        <SidebarMenu>
          {isPending &&
            Array.from({ length: 5 }, (_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}
          {!isPending && conversations.length === 0 && (
            <p className="text-muted-foreground px-2 py-1 text-xs">
              {filter ? "No matching chats" : "No chats yet"}
            </p>
          )}
          {conversations.map((conversation) => (
            <SidebarMenuItem key={conversation.id}>
              <SidebarMenuButton asChild isActive={pathname === `/chat/${conversation.id}`}>
                <Link href={`/chat/${conversation.id}`} title={conversation.title}>
                  <span>{conversation.title}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">Chat actions</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem onSelect={() => setRenaming(conversation)}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting(conversation)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>

      <RenameDialog
        open={renaming !== null}
        initialValue={renaming?.title ?? ""}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(title) => renaming && rename.mutate({ id: renaming.id, title })}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this chat?"
        description={
          <>&ldquo;{deleting?.title}&rdquo; and all of its messages will be permanently deleted.</>
        }
        onConfirm={() => (deleting ? remove.mutateAsync(deleting.id) : Promise.resolve())}
      />
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { data: user } = useCurrentUser();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/chat" className="px-1 py-1.5 group-data-[collapsible=icon]:px-0">
          <Logo className="group-data-[collapsible=icon]:[&>span]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={NAV} />
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavItems items={ADMIN_NAV} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <ChatHistory />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
