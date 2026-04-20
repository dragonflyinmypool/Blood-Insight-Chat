import Link from "next/link";
import { format } from "date-fns";
import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NewChatButton } from "./new-chat";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatListPage() {
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
          <p className="text-sm text-muted-foreground">Ask questions about your blood tests.</p>
        </div>
        <NewChatButton />
      </div>

      {!conversations || conversations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No conversations yet.</p>
            <div className="mt-4">
              <NewChatButton />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
