import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  Analytics,
  Conversation,
  ConversationDetail,
  DocumentItem,
  Page,
  ServiceHealth,
  User,
} from "@/types";

export const queries = {
  me: () => queryOptions({ queryKey: ["me"], queryFn: () => api<User>("/users/me") }),

  documents: () =>
    queryOptions({
      queryKey: ["documents"],
      queryFn: () => api<DocumentItem[]>("/documents"),
      refetchInterval: (query) =>
        query.state.data?.some((d) => d.status === "processing") ? 2000 : false,
    }),

  conversations: () =>
    queryOptions({
      queryKey: ["conversations"],
      queryFn: () => api<Page<Conversation>>("/conversations?limit=100"),
    }),

  conversation: (id: string) =>
    queryOptions({
      queryKey: ["conversations", id],
      queryFn: () => api<ConversationDetail>(`/conversations/${id}`),
    }),

  analytics: (days: number) =>
    queryOptions({
      queryKey: ["admin", "analytics", days],
      queryFn: () => api<Analytics>(`/admin/analytics?days=${days}`),
    }),

  serviceHealth: () =>
    queryOptions({
      queryKey: ["admin", "health"],
      queryFn: () => api<ServiceHealth>("/admin/health"),
      refetchInterval: 15_000,
    }),
};
