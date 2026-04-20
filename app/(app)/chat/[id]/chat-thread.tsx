"use client";

import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Message = { id: number | string; role: "user" | "assistant"; content: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: number;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");

    try {
      // Streaming responses require a manual fetch; supabase.functions.invoke
      // buffers the whole body. We include the user's access token so RLS
      // applies inside the edge function.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not signed in");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ conversationId, content }),
      });
      if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(part.slice(6));
            if (payload.error) {
              toast.error("Stream error", { description: payload.error });
              continue;
            }
            if (payload.content) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + payload.content } : m))
              );
            }
          } catch {
            // ignore malformed frames
          }
        }
      }
    } catch (err) {
      toast.error("Send failed", { description: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Ask anything about your blood tests.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}
            >
              {m.content || (sending && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 pt-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="min-h-[60px] resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon" className="h-[60px] w-11">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );
}
