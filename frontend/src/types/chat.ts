import type { Source } from "@/types/api";

export type StreamState = { question: string; answer: string; sources: Source[] | null };

export type ServerSentEvent = { event: string; data: string };

export type ComposerProps = {
  onSend: (question: string) => void;
  onStop?: () => void;
  busy: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export type DocumentScopeProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export type AssistantMessageProps = {
  content: string;
  sources: Source[] | null;
  streaming?: boolean;
};
