"use client";

import { FileText, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const eventName = "agent-garden:open-upload";

export function openUpload() {
  window.dispatchEvent(new Event(eventName));
}

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(eventName, show);
    return () => window.removeEventListener(eventName, show);
  }, []);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function close() {
    if (uploading) return;
    setOpen(false);
    setError("");
    setFile(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a PDF to continue.");
    if (file.size > 5 * 1024 * 1024) return setError("PDFs must be 5 MB or smaller.");

    setUploading(true);
    setError("");
    const body = new FormData();
    body.set("document", file);
    try {
      const response = await fetch("/api/agents", { method: "POST", body });
      const result = (await response.json()) as { agent?: { id: string }; error?: string };
      if (!response.ok || !result.agent) throw new Error(result.error || "Upload failed");
      setOpen(false);
      window.dispatchEvent(new Event("agent-garden:changed"));
      router.push(`/agents/${result.agent.id}`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={() => setOpen(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-[#d4dfd1] bg-[#fffef9] p-0 text-[#183126] shadow-2xl backdrop:bg-[#10291d]/45"
    >
      <form onSubmit={submit} className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="mb-1 text-xs font-bold uppercase text-[#4b765a]">New agent</p><h2 className="font-display text-2xl font-semibold">Plant a document agent</h2></div>
          <button type="button" onClick={close} aria-label="Close upload" className="grid size-9 place-items-center rounded hover:bg-[#edf3ea]"><X size={19} /></button>
        </div>
        <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#9fbea5] bg-[#f2f8ef] px-5 text-center transition hover:border-[#4d865e] hover:bg-[#ebf5e8]">
          {file ? <FileText size={32} className="mb-3 text-[#2d7246]" /> : <Upload size={32} className="mb-3 text-[#2d7246]" />}
          <span className="max-w-full truncate text-sm font-semibold">{file?.name || "Choose a PDF document"}</span>
          <span className="mt-1 text-xs text-[#667b6d]">Text-based PDF · up to 10 pages · 5 MB maximum</span>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-[#a43b32]">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={close} className="h-10 rounded-md border border-[#cad8c7] px-4 text-sm font-semibold hover:bg-[#f0f4ee]">Cancel</button>
          <button type="submit" disabled={!file || uploading} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white hover:bg-[#184b2d] disabled:cursor-not-allowed disabled:opacity-50">
            {uploading && <LoaderCircle size={17} className="animate-spin" />}{uploading ? "Reading document..." : "Create agent"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
