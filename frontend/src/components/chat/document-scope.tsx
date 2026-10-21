"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Files } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queries } from "@/lib/queries";
import type { DocumentScopeProps } from "@/types";

export function DocumentScope({ value, onChange, disabled }: DocumentScopeProps) {
  const { data: documents = [] } = useQuery(queries.documents());
  const ready = documents.filter((d) => d.status === "ready");
  const selected = new Set(value);

  const label =
    value.length === 0
      ? "All documents"
      : value.length === 1
        ? (documents.find((d) => d.id === value[0])?.filename ?? "1 document")
        : `${value.length} documents`;

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange([...next]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="max-w-56">
          <Files />
          <span className="truncate">{label}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Search in</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={value.length === 0}
          onCheckedChange={() => onChange([])}
          onSelect={(e) => e.preventDefault()}
        >
          All documents
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {ready.length === 0 ? (
          <DropdownMenuItem disabled>No indexed documents yet</DropdownMenuItem>
        ) : (
          ready.map((document) => (
            <DropdownMenuCheckboxItem
              key={document.id}
              checked={selected.has(document.id)}
              onCheckedChange={(checked) => toggle(document.id, checked === true)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{document.filename}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
