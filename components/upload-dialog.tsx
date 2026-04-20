"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, File as FileIcon, X, Loader2 } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

export function UploadDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [notes, setNotes] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Invalid file type", { description: "Please select a PDF." });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 10MB." });
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("upload-blood-test", {
        body: { fileName: file.name, pdfBase64: base64, notes: notes.trim() || undefined },
      });

      if (error) {
        // Supabase invoke wraps non-2xx as FunctionsHttpError; message has body.error
        const status = (error as { context?: { status?: number } }).context?.status;
        const msg = (data as { error?: string } | null)?.error ?? error.message;
        toast.error(status === 409 ? "Already uploaded" : "Upload failed", { description: msg });
        setUploading(false);
        return;
      }

      toast.success("Upload successful", { description: "Your blood test results have been extracted." });
      setOpen(false);
      setFile(null);
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Blood Test</DialogTitle>
          <DialogDescription>
            Upload a PDF of your lab results. We&apos;ll automatically extract the biomarkers and reference ranges.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-6 transition-colors hover:bg-muted/80"
            onClick={() => !file && fileInput.current?.click()}
            role="button"
          >
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex w-full items-center gap-3 rounded-md border bg-background p-3">
                <FileIcon className="h-8 w-8 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileUp className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Click to select PDF</p>
                <p className="mt-1 text-xs text-muted-foreground">Maximum 10MB</p>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Fasting status, time of day, how you were feeling..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Upload and extract"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
