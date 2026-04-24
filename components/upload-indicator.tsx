"use client";

import { Loader2 } from "lucide-react";
import { useUploadQueue } from "@/components/upload-queue-provider";

export function UploadIndicator() {
  const { items, activeCount } = useUploadQueue();
  if (activeCount === 0) return null;

  const uploading = items.find((i) => i.status === "uploading");
  const queued = items.filter((i) => i.status === "queued").length;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-xs">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {uploading ? uploading.fileName : "Queued"}
        </p>
        <p className="text-muted-foreground">
          {activeCount} uploading{queued > 0 && uploading ? ` · ${queued} queued` : ""}
        </p>
      </div>
    </div>
  );
}
