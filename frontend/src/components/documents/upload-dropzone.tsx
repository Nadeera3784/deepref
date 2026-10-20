"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_MB = 25;

type Upload = { id: string; name: string; progress: number };

/** XHR instead of fetch so we can report upload progress. */
function uploadFile(file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detail = `Upload failed (${xhr.status})`;
      try {
        detail = JSON.parse(xhr.responseText).detail ?? detail;
      } catch {}
      reject(new Error(detail));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function UploadDropzone() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);

  async function handleFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: only PDF files are supported`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name}: larger than ${MAX_MB} MB`);
        continue;
      }
      const id = crypto.randomUUID();
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        await uploadFile(file, (progress) =>
          setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))),
        );
        toast.success(`${file.name} uploaded. Indexing…`);
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (error) {
        toast.error(`${file.name}: ${(error as Error).message}`);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "hover:bg-muted/50 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          dragging && "border-primary bg-muted/50",
        )}
      >
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <FileUp className="text-muted-foreground size-6" />
        </div>
        <p className="font-medium">Drop PDFs here or click to browse</p>
        <p className="text-muted-foreground text-sm">Text-based PDFs up to {MAX_MB} MB</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploads.map((upload) => (
        <div key={upload.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
          <span className="min-w-0 flex-1 truncate">{upload.name}</span>
          <Progress value={upload.progress} className="w-40" />
          <span className="text-muted-foreground w-10 text-right tabular-nums">
            {Math.round(upload.progress)}%
          </span>
        </div>
      ))}
    </div>
  );
}
