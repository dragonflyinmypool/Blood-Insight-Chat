"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function PdfLink({
  userId,
  contentHash,
  fileName,
  testId,
}: {
  userId: string;
  contentHash: string | null;
  fileName: string;
  testId: number;
}) {
  const [loading, setLoading] = useState(false);

  if (!contentHash) {
    return (
      <Link
        href={`/tests/${testId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <FileText className="h-3.5 w-3.5" />
        {fileName}
      </Link>
    );
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("blood-tests")
      .createSignedUrl(`${userId}/${contentHash}.pdf`, 60);
    setLoading(false);
    if (error || !data?.signedUrl) {
      toast.error("Could not open PDF", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
    >
      <FileText className="h-3.5 w-3.5" />
      <span className="max-w-[220px] truncate">{fileName}</span>
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}
