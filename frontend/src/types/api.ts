export type Role = "user" | "admin";

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type AdminUser = User & {
  document_count: number;
  conversation_count: number;
};

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type DocumentStatus = "processing" | "ready" | "failed";

export type DocumentItem = {
  id: string;
  filename: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  status: DocumentStatus;
  error: string | null;
  created_at: string;
};

export type Source = {
  index: number;
  document_id: string;
  filename: string;
  page_number: number;
  snippet: string;
  score: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
};

export type ConversationDetail = Conversation & { messages: ChatMessage[] };

export type Analytics = {
  totals: {
    users: number;
    active_users: number;
    documents: number;
    chunks: number;
    storage_bytes: number;
    conversations: number;
    questions: number;
    total_tokens: number;
    avg_latency_ms: number | null;
  };
  daily: { day: string; questions: number; new_users: number; documents: number }[];
  top_users: { email: string; full_name: string | null; questions: number; documents: number }[];
  documents_by_status: { status: DocumentStatus; count: number }[];
};

export type ServiceHealth = {
  database: boolean;
  storage: boolean;
  llm: boolean;
  embeddings: boolean;
};

export type TokenResponse = { access_token: string; expires_in: number };

export type FastApiError = { detail?: string | { msg: string }[] };
