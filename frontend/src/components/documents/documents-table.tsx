"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/documents/status-badge";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { queries } from "@/lib/queries";
import type { DocumentItem } from "@/types";

export function DocumentsTable() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(queries.documents());
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Document deleted");
      return queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No documents yet</EmptyTitle>
          <EmptyDescription>Upload a PDF above to build your knowledge base.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right md:table-cell">Pages</TableHead>
            <TableHead className="hidden text-right md:table-cell">Size</TableHead>
            <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="max-w-0 w-full">
                <div className="flex items-center gap-2">
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate font-medium" title={document.filename}>
                    {document.filename}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge document={document} />
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {document.page_count || "—"}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {formatBytes(document.size_bytes)}
              </TableCell>
              <TableCell className="text-muted-foreground hidden lg:table-cell">
                {formatDate(document.created_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Document actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a
                        href={`/api/documents/${document.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink /> Open PDF
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(document)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.filename ?? "document"}?`}
        description="The file and its index are removed permanently. Past answers that cite it stay in your chat history."
        onConfirm={() => (deleting ? remove.mutateAsync(deleting.id) : Promise.resolve())}
      />
    </div>
  );
}
