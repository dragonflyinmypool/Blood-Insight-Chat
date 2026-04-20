import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "./chat-thread";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) notFound();

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col md:h-[calc(100vh-1.5rem)]">
      <div className="shrink-0 space-y-1 pb-4">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All conversations
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{conversation.title}</h1>
      </div>
      <ChatThread
        conversationId={id}
        initialMessages={(messages ?? []).map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }))}
      />
    </div>
  );
}
