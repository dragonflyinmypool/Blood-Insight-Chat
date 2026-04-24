"use client";

import * as React from "react";
import { FileUp, File as FileIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUploadQueue } from "@/components/upload-queue-provider";

const MAX_SIZE = 10 * 1024 * 1024;

export function UploadDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [notes, setNotes] = React.useState("");
  const fileInput = React.useRef<HTMLInputElement>(null);
  const { enqueue } = useUploadQueue();

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (f.type !== "application/pdf") {
        toast.error(`Skipped ${f.name}`, { description: "Only PDF files are supported." });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`Skipped ${f.name}`, { description: "Maximum file size is 10MB." });
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      // Dedupe by name+size so accidental double-picks don't get queued twice.
      setFiles((curr) => {
        const seen = new Set(curr.map((f) => `${f.name}:${f.size}`));
        return [...curr, ...accepted.filter((f) => !seen.has(`${f.name}:${f.size}`))];
      });
    }
  }

  function removeAt(idx: number) {
    setFiles((curr) => curr.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (files.length === 0) return;
    enqueue(files.map((file) => ({ file, notes })));
    toast.info(
      files.length === 1 ? "Upload started" : `${files.length} uploads queued`,
      { description: "You can navigate away — we'll notify you as each one finishes." }
    );
    setFiles([]);
    setNotes("");
    if (fileInput.current) fileInput.current.value = "";
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Blood Tests</DialogTitle>
          <DialogDescription>
            Upload one or more PDFs. We&apos;ll extract biomarkers in the background so you can
            keep using the app.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-6 transition-colors hover:bg-muted/80"
            onClick={() => fileInput.current?.click()}
            role="button"
          >
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
                // Allow picking the same file again after removing it.
                e.target.value = "";
              }}
            />
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Click to select PDFs</p>
              <p className="mt-1 text-xs text-muted-foreground">One or many. Max 10MB each.</p>
            </div>
          </div>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, idx) => (
                <li
                  key={`${f.name}:${f.size}:${idx}`}
                  className="flex items-center gap-3 rounded-md border bg-background p-2"
                >
                  <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAt(idx);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Fasting status, time of day, how you were feeling..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {files.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Applied to all {files.length} uploads.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={files.length === 0}>
            {files.length === 0
              ? "Upload"
              : files.length === 1
                ? "Upload 1 file"
                : `Upload ${files.length} files`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
