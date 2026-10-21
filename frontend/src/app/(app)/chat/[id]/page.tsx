import { Suspense } from "react";

import { ChatView } from "@/components/chat/chat-view";

export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: Pick<PageProps<"/chat/[id]">, "params">) {
  const { id } = await params;
  return <ChatView key={id} conversationId={id} />;
}
