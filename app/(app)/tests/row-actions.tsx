"use client";

import { useRouter } from "next/navigation";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function TestRowActions({ id }: { id: number }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this test and all its results?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("blood_tests").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Test deleted");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
