"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function NewChatButton() {
  const router = useRouter();

  async function create() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ title: "New conversation" })
      .select()
      .single();
    if (error || !data) {
      toast.error("Could not create conversation", { description: error?.message });
      return;
    }
    router.push(`/chat/${data.id}`);
  }

  return (
    <Button onClick={create}>
      <Plus className="mr-2 h-4 w-4" />
      New chat
    </Button>
  );
}
