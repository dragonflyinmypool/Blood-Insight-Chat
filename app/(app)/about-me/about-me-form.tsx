"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

type Sex = (typeof SEX_OPTIONS)[number]["value"];
const SEX_SET = new Set<string>(SEX_OPTIONS.map((o) => o.value));

export function AboutMeForm({
  userId,
  initialDateOfBirth,
  initialSex,
  initialNotes,
}: {
  userId: string;
  initialDateOfBirth: string | null;
  initialSex: string | null;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [dateOfBirth, setDateOfBirth] = React.useState(initialDateOfBirth ?? "");
  const [sex, setSex] = React.useState<Sex | "">(
    initialSex && SEX_SET.has(initialSex) ? (initialSex as Sex) : ""
  );
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        date_of_birth: dateOfBirth || null,
        sex: sex || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      toast.error("Could not save", { description: error.message });
      return;
    }
    toast.success("Saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <Select
            value={sex || undefined}
            onValueChange={(v) => setSex(v as Sex)}
            disabled={saving}
          >
            <SelectTrigger id="sex">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {SEX_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={6}
          placeholder="e.g. On atorvastatin 20mg. Family history of type 2 diabetes. Vegetarian."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          Anything you&apos;d want the AI to factor in when explaining your results.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
