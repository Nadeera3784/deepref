"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { UserDialog } from "@/components/admin/user-dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AdminUser, Page } from "@/lib/types";

const PAGE_SIZE = 20;

export function UsersTable() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (query) params.set("q", query);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "users", query, page],
    queryFn: () => api<Page<AdminUser>>(`/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      return queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <UserPlus /> Add user
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right md:table-cell">Documents</TableHead>
              <TableHead className="hidden text-right md:table-cell">Chats</TableHead>
              <TableHead className="hidden lg:table-cell">Last login</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="max-w-0 w-full">
                  <div className="truncate font-medium">{user.full_name || "—"}</div>
                  <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "outline" : "destructive"}>
                    {user.is_active ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {user.document_count}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {user.conversation_count}
                </TableCell>
                <TableCell className="text-muted-foreground hidden whitespace-nowrap lg:table-cell">
                  {user.last_login_at ? formatDateTime(user.last_login_at) : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground hidden whitespace-nowrap lg:table-cell">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="User actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(user)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={user.id === me?.id}
                        onSelect={() => setDeleting(user)}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {data ? `${data.total} user${data.total === 1 ? "" : "s"}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <UserDialog open={creating} onOpenChange={setCreating} />
      <UserDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.email ?? "user"}?`}
        description="Their documents, chats and uploaded files are permanently deleted. This cannot be undone."
        confirmLabel="Delete user"
        onConfirm={() => (deleting ? remove.mutateAsync(deleting.id) : Promise.resolve())}
      />
    </div>
  );
}
