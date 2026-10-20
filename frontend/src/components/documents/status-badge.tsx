import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DocumentItem } from "@/lib/types";

export function StatusBadge({ document }: { document: DocumentItem }) {
  switch (document.status) {
    case "processing":
      return (
        <Badge variant="secondary">
          <Spinner className="size-3" /> Indexing
        </Badge>
      );
    case "ready":
      return <Badge variant="outline">Ready</Badge>;
    case "failed":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive">Failed</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{document.error ?? "Unknown error"}</TooltipContent>
        </Tooltip>
      );
  }
}
