"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DocumentScope } from "@/components/chat/document-scope";
import { AssistantMessage, UserMessage } from "@/components/chat/message";
import { pendingQuestions } from "@/components/chat/pending-questions";
import { Composer } from "@/components/chat/composer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, apiFetch, json } from "@/lib/api";
import { queries } from "@/lib/queries";
import { readEventStream } from "@/lib/sse";
import type { Conversation, ConversationDetail, Source, StreamState } from "@/types";

export function ChatView({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const conversation = useQuery({
    ...queries.conversation(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
  const documents = useQuery(queries.documents());

  const [newChatScope, setNewChatScope] = useState<string[]>([]);
  const [handoff] = useState(() =>
    conversationId ? pendingQuestions.get(conversationId) : undefined,
  );
  const [stream, setStream] = useState<StreamState | null>(() =>
    handoff ? { question: handoff, answer: "", sources: null } : null,
  );
  const [creating, setCreating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const runStream = useCallback(
    async (id: string, question: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await apiFetch(`/conversations/${id}/messages`, {
          method: "POST",
          body: json({ content: question }),
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });
        for await (const event of readEventStream(response.body!)) {
          const data = JSON.parse(event.data);
          if (event.event === "sources") {
            setStream((s) => s && { ...s, sources: data as Source[] });
          } else if (event.event === "token") {
            const delta = (data as { content: string }).content;
            setStream((s) => s && { ...s, answer: s.answer + delta });
          } else if (event.event === "error") {
            toast.error((data as { detail: string }).detail);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          toast.error(error instanceof Error ? error.message : "Something went wrong");
        }
      } finally {
        abortRef.current = null;
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setStream(null);
      }
    },
    [queryClient],
  );

  function ask(id: string, question: string) {
    setStream({ question, answer: "", sources: null });
    void runStream(id, question);
  }

  const startedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || !handoff || startedRef.current) return;
    startedRef.current = true;
    pendingQuestions.delete(conversationId);
    void runStream(conversationId, handoff);
  }, [conversationId, handoff, runStream]);

  const messageCount = conversation.data?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, stream?.answer, stream?.question]);

  async function sendFromNewChat(question: string) {
    setCreating(true);
    try {
      const created = await api<Conversation>("/conversations", {
        method: "POST",
        body: json({ document_ids: newChatScope }),
      });
      pendingQuestions.set(created.id, question);
      queryClient.setQueryData<ConversationDetail>(queries.conversation(created.id).queryKey, {
        ...created,
        messages: [],
      });
      router.push(`/chat/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start a chat");
      setCreating(false);
    }
  }

  async function updateScope(ids: string[]) {
    if (!conversationId) {
      setNewChatScope(ids);
      return;
    }
    try {
      const updated = await api<Conversation>(`/conversations/${conversationId}`, {
        method: "PATCH",
        body: json({ document_ids: ids }),
      });
      queryClient.setQueryData<ConversationDetail>(
        queries.conversation(conversationId).queryKey,
        (old) => old && { ...old, ...updated },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update documents");
    }
  }

  if (conversation.error instanceof ApiError && [404, 422].includes(conversation.error.status)) {
    return (
      <>
        <PageHeader title="Chat not found" />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This chat doesn&apos;t exist</EmptyTitle>
            <EmptyDescription>It may have been deleted.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/chat">Start a new chat</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    );
  }

  const busy = stream !== null || creating;
  const messages = conversation.data?.messages ?? [];
  const scope = conversationId ? (conversation.data?.document_ids ?? []) : newChatScope;
  const hasReadyDocuments = documents.data?.some((d) => d.status === "ready") ?? true;
  const isEmpty = !conversationId || (conversation.isSuccess && !messages.length && !stream);

  return (
    <div className="flex h-svh flex-col">
      <PageHeader title={conversation.data?.title ?? "New chat"}>
        <DocumentScope value={scope} onChange={updateScope} disabled={busy} />
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {conversationId && conversation.isLoading && <MessagesSkeleton />}

          {isEmpty && !conversation.isLoading && (
            <Empty className="mt-[10vh] border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {hasReadyDocuments ? <MessagesSquare /> : <FileUp />}
                </EmptyMedia>
                <EmptyTitle>
                  {hasReadyDocuments ? "Ask your documents anything" : "Upload a PDF to get started"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasReadyDocuments
                    ? "Answers are grounded in your PDFs and cite the pages they come from."
                    : "Once a document is indexed you can ask questions about it here."}
                </EmptyDescription>
              </EmptyHeader>
              {!hasReadyDocuments && (
                <EmptyContent>
                  <Button asChild>
                    <Link href="/documents">Upload documents</Link>
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AssistantMessage
                key={message.id}
                content={message.content}
                sources={message.sources}
              />
            ),
          )}

          {stream && (
            <>
              <UserMessage content={stream.question} />
              <AssistantMessage content={stream.answer} sources={stream.sources} streaming />
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer
          busy={busy}
          onSend={(question) =>
            conversationId ? ask(conversationId, question) : void sendFromNewChat(question)
          }
          onStop={() => abortRef.current?.abort()}
        />
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Answers are generated by a small local model and may be inaccurate. Check the sources.
        </p>
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
