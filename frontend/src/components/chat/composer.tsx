"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerProps } from "@/types";

export function Composer({ onSend, onStop, busy, disabled, placeholder }: ComposerProps) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !busy && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="bg-background focus-within:ring-ring/50 relative rounded-2xl border shadow-sm focus-within:ring-[3px]"
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder ?? "Ask a question about your documents…"}
        maxLength={4000}
        rows={1}
        disabled={disabled}
        className="max-h-48 min-h-14 resize-none border-0 bg-transparent py-4 pr-14 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="absolute right-2 bottom-2">
        {busy && onStop ? (
          <Button type="button" size="icon" variant="secondary" onClick={onStop} aria-label="Stop">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!canSend} aria-label="Send">
            <ArrowUp />
          </Button>
        )}
      </div>
    </form>
  );
}
