import { FileText } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Source } from "@/types";

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <Tooltip key={source.index}>
          <TooltipTrigger asChild>
            <a
              href={`/api/documents/${source.document_id}/file#page=${source.page_number}`}
              target="_blank"
              rel="noreferrer"
              className="bg-muted hover:bg-accent text-muted-foreground hover:text-foreground inline-flex max-w-64 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors"
            >
              <span className="text-foreground font-medium">[{source.index}]</span>
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{source.filename}</span>
              <span className="shrink-0">p.{source.page_number}</span>
            </a>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-left leading-relaxed whitespace-pre-line">
            {source.snippet.length > 400 ? `${source.snippet.slice(0, 400)}…` : source.snippet}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
