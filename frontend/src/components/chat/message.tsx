"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Markdown } from "@/components/chat/markdown";
import { Sources } from "@/components/chat/sources";
import { Button } from "@/components/ui/button";
import type { Source } from "@/lib/types";

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

type AssistantProps = { content: string; sources: Source[] | null; streaming?: boolean };

export function AssistantMessage({ content, sources, streaming = false }: AssistantProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group flex flex-col">
      {content ? (
        <Markdown>{content}</Markdown>
      ) : streaming ? (
        <TypingIndicator />
      ) : (
        <p className="text-muted-foreground text-sm italic">No answer was generated.</p>
      )}
      {streaming && content && (
        <span className="bg-foreground mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm" />
      )}
      {sources && <Sources sources={sources} />}
      {!streaming && content && (
        <div className="mt-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy answer">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex h-6 items-center gap-1" aria-label="Generating answer">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="bg-muted-foreground size-2 animate-bounce rounded-full"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
