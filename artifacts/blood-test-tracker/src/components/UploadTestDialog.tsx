import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, File, X, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useUploadBloodTest, getListBloodTestsQueryKey, getGetBloodTestSummaryQueryKey } from "@workspace/api-client-react";

export function UploadTestDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useUploadBloodTest();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Extract just the base64 part
        const base64Data = base64String.split(",")[1];

        uploadMutation.mutate(
          {
            data: {
              fileName: file.name,
              pdfBase64: base64Data,
              notes: notes.trim() || undefined,
            },
          },
          {
            onSuccess: () => {
              toast({
                title: "Upload successful",
                description: "Your blood test results have been extracted.",
              });
              queryClient.invalidateQueries({ queryKey: getListBloodTestsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetBloodTestSummaryQueryKey() });
              setOpen(false);
              setFile(null);
              setNotes("");
            },
            onError: (error) => {
              const data = error?.data as { error?: string } | null;
              const isDuplicate = error?.status === 409;
              toast({
                title: isDuplicate ? "Already uploaded" : "Upload failed",
                description: data?.error || "There was a problem processing your PDF.",
                variant: "destructive",
              });
            },
          }
        );
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload error",
        description: "Failed to read file.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Blood Test</DialogTitle>
          <DialogDescription>
            Upload a PDF of your lab results. We'll automatically extract the biomarkers and reference ranges.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer" onClick={() => !file && fileInputRef.current?.click()}>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
            
            {file ? (
              <div className="flex items-center gap-3 w-full p-3 bg-background rounded-md border">
                <File className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={uploadMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <FileUp className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Click to select PDF</p>
                <p className="text-xs text-muted-foreground mt-1">Maximum 10MB</p>
              </div>
            )}
          </div>
          
          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes (Optional)
            </label>
            <Textarea 
              id="notes" 
              placeholder="Add context like fasting status, time of day, how you were feeling..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploadMutation.isPending}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Upload and Extract"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
