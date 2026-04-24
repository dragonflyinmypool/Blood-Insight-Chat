"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export type UploadItem = {
  id: string;
  fileName: string;
  size: number;
  notes?: string;
  status: UploadStatus;
  error?: string;
  // File lives on the item until it's been sent — we intentionally keep it in
  // memory rather than persisting to IndexedDB. The queue dies with the tab.
  file?: File;
};

type EnqueueInput = { file: File; notes?: string };

type QueueContext = {
  items: UploadItem[];
  enqueue: (uploads: EnqueueInput[]) => void;
  remove: (id: string) => void;
  activeCount: number;
};

const Ctx = React.createContext<QueueContext | null>(null);

export function useUploadQueue() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useUploadQueue must be used inside UploadQueueProvider");
  return ctx;
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const router = useRouter();

  // Ref mirror so the worker loop sees the latest state without re-subscribing.
  const itemsRef = React.useRef<UploadItem[]>(items);
  itemsRef.current = items;
  const workingRef = React.useRef(false);

  const update = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((curr) => curr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const processNext = React.useCallback(async () => {
    if (workingRef.current) return;
    const next = itemsRef.current.find((i) => i.status === "queued");
    if (!next || !next.file) return;
    workingRef.current = true;

    update(next.id, { status: "uploading" });

    try {
      const base64 = await fileToBase64(next.file);
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("upload-blood-test", {
        body: { fileName: next.fileName, pdfBase64: base64, notes: next.notes },
      });

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        const msg = (data as { error?: string } | null)?.error ?? error.message;
        update(next.id, {
          status: "error",
          error: msg,
          file: undefined,
        });
        toast.error(status === 409 ? "Already uploaded" : `Upload failed: ${next.fileName}`, {
          description: msg,
        });
      } else {
        update(next.id, { status: "done", file: undefined });
        toast.success(`Uploaded ${next.fileName}`, {
          description: "Results extracted and added to your dashboard.",
        });
        router.refresh();
      }
    } catch (err) {
      update(next.id, {
        status: "error",
        error: (err as Error).message,
        file: undefined,
      });
      toast.error(`Upload failed: ${next.fileName}`, { description: (err as Error).message });
    } finally {
      workingRef.current = false;
      // Chain to the next queued item.
      if (itemsRef.current.some((i) => i.status === "queued")) {
        void processNext();
      }
    }
  }, [router, update]);

  const enqueue = React.useCallback(
    (uploads: EnqueueInput[]) => {
      if (uploads.length === 0) return;
      const added: UploadItem[] = uploads.map(({ file, notes }) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        size: file.size,
        notes: notes?.trim() || undefined,
        status: "queued",
        file,
      }));
      setItems((curr) => [...curr, ...added]);
      // Kick the worker on the next tick so state has settled.
      queueMicrotask(() => void processNext());
    },
    [processNext]
  );

  const remove = React.useCallback((id: string) => {
    setItems((curr) => curr.filter((i) => i.id !== id));
  }, []);

  const activeCount = items.filter((i) => i.status === "queued" || i.status === "uploading").length;

  const value = React.useMemo(
    () => ({ items, enqueue, remove, activeCount }),
    [items, enqueue, remove, activeCount]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
