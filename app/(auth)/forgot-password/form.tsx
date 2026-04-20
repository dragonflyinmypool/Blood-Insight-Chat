"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      toast.error("Could not send reset email", { description: error.message });
      return;
    }
    setSent(true);
    toast.success("Check your email", { description: "We sent you a reset link." });
  }

  if (sent) {
    return (
      <div className="rounded-md bg-muted p-4 text-sm">
        If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. Check
        your email (or{" "}
        <a href="http://127.0.0.1:54324" target="_blank" rel="noreferrer" className="underline">
          Mailpit
        </a>{" "}
        for local dev).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
      </Button>
    </form>
  );
}
