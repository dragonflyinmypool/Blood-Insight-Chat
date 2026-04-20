"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm({ initialName, userId }: { initialName: string; userId: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const display = name.trim();
    if (!display) {
      toast.error("Please enter a name");
      return;
    }
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: display, onboarded: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setLoading(false);
    if (error) {
      toast.error("Could not save profile", { description: error.message });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to dashboard"}
      </Button>
    </form>
  );
}
