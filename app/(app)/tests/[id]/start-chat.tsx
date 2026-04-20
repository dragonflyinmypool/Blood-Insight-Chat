"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Slot } from "@radix-ui/react-slot";
import { createClient } from "@/lib/supabase/client";

export function StartChatButton({
  bloodTestId,
  testDate,
  children,
}: {
  bloodTestId: number;
  testDate: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function start() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const title = `Discussion about test${testDate ? ` from ${testDate}` : ""}`;
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({ title, blood_test_id: bloodTestId })
        .select()
        .single();
      if (error || !data) throw error ?? new Error("Insert failed");
      router.push(`/chat/${data.id}`);
    } catch (err) {
      toast.error("Could not start chat", { description: (err as Error).message });
      setLoading(false);
    }
  }

  return (
    <Slot onClick={start} data-loading={loading}>
      {children}
    </Slot>
  );
}
