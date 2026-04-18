import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, User, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "@/components/layout/Header";
import { useGetChatConversation, getGetChatConversationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: number | string;
  role: string;
  content: string;
  createdAt?: string;
}

export default function ActiveChat() {
  const { id } = useParams();
  const chatId = id ? parseInt(id) : 0;
  
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const queryClient = useQueryClient();
  const { data: chatData, isLoading } = useGetChatConversation(chatId, {
    query: { enabled: !!chatId, queryKey: getGetChatConversationQueryKey(chatId) }
  });

  // Sync server messages to local state on initial load
  useEffect(() => {
    if (chatData?.messages && localMessages.length === 0) {
      setLocalMessages(chatData.messages);
    }
  }, [chatData, localMessages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
    };

    const botMessageId = `bot-${Date.now()}`;
    const initialBotMessage: Message = {
      id: botMessageId,
      role: 'assistant',
      content: '',
    };

    setLocalMessages(prev => [...prev, userMessage, initialBotMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/chat/conversations/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage.content })
      });

      if (!response.ok) throw new Error("Failed to send message");
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              try {
                const data = JSON.parse(dataStr);
                if (data.done) {
                  // Re-fetch to get official IDs saved in DB
                  queryClient.invalidateQueries({ queryKey: getGetChatConversationQueryKey(chatId) });
                  continue;
                }
                
                if (data.content) {
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === botMessageId 
                      ? { ...msg, content: msg.content + data.content } 
                      : msg
                  ));
                }
              } catch (e) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setLocalMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: "Sorry, I encountered an error responding to your request." } 
          : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <Header title={chatData?.title || "Health Chat"}>
        <Link href="/chat">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Chats</span>
          </Button>
        </Link>
      </Header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full pt-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : localMessages.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">How can I help you?</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Ask about specific biomarkers, what certain results mean, or request general wellness advice based on your uploaded reports.
              </p>
            </div>
          ) : (
            localMessages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}
                
                <div 
                  className={`px-4 py-3 rounded-2xl max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted/60 text-foreground border rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.content || (isStreaming && msg.role !== 'user' ? <span className="animate-pulse">...</span> : '')}
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your blood test results..." 
            className="pr-12 h-12 rounded-full border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
            disabled={isStreaming}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1.5 h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-muted-foreground">
            AI responses may contain inaccuracies. Always consult your doctor for medical advice.
          </span>
        </div>
      </div>
    </div>
  );
}
