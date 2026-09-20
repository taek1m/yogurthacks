"use client";

import { FileText, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const eventName = "agent-garden:create-topic-agent";

export function openTopicAgent() {
  window.dispatchEvent(new Event(eventName));
}

export function CreateTopicModal() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dropping, setDropping] = useState(false);
  // dragenter/dragleave also fire for children, so count them instead of toggling.
  const dragDepth = useRef(0);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(eventName, show);
    return () => window.removeEventListener(eventName, show);
  }, []);

  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      window.setTimeout(() => input.current?.focus(), 50);
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function isPdf(candidate: File) {
    return candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
  }

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function onDragEnter(event: React.DragEvent) {
    if (!hasFiles(event) || creating) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDropping(true);
  }

  function onDragLeave(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  }

  function onDrop(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    if (creating) return;
    const files = Array.from(event.dataTransfer.files);
    const pdf = files.find(isPdf);
    if (!pdf) {
      setError(files.length ? "Only PDF documents can be turned into an agent." : "That drop had no file in it.");
      return;
    }
    setError(files.length > 1 ? "Only the first PDF was used." : "");
    setFile(pdf);
  }

  function close() {
    if (creating) return;
    setOpen(false);
    setError("");
    setFile(null);
    setDropping(false);
    dragDepth.current = 0;
  }

  /** Uploading a PDF creates a document agent; Gemini names it from the file. */
  async function createFromPdf(pdf: File) {
    const body = new FormData();
    body.set("document", pdf);
    const response = await fetch("/api/agents", { method: "POST", body });
    const result = (await response.json()) as { agent?: { id: string }; error?: string };
    if (!response.ok || !result.agent) throw new Error(result.error || "The PDF could not be analyzed");
    return result.agent.id;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = topic.trim();
    if (!file && value.length < 3) {
      return setError("Upload a PDF, or enter a topic with at least 3 characters.");
    }
    if (file && file.size > 5 * 1024 * 1024) return setError("PDFs must be 5 MB or smaller.");

    setCreating(true);
    setError("");
    try {
      let agentId: string;
      if (file) {
        agentId = await createFromPdf(file);
      } else {
        const response = await fetch("/api/agents/topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: value }),
        });
        const result = (await response.json()) as { agent?: { id: string }; error?: string };
        if (!response.ok || !result.agent) throw new Error(result.error || "Agent creation failed");
        agentId = result.agent.id;
      }
      setOpen(false);
      setTopic("");
      setFile(null);
      window.dispatchEvent(new Event("agent-garden:changed"));
      router.push(`/agents/${agentId}`);
      router.refresh();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Agent creation failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={() => setOpen(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-[#d4dfd1] bg-[#fffef9] p-0 text-[#183126] shadow-2xl backdrop:bg-[#10291d]/45"
    >
      <form
        onSubmit={submit}
        className="p-5 sm:p-6"
        onDragEnter={onDragEnter}
        onDragOver={(event) => { if (hasFiles(event)) event.preventDefault(); }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 grid size-10 place-items-center rounded-md bg-[#e3f0de] text-[#2f7047]"><Sparkles size={20} /></span>
            <p className="text-xs font-bold uppercase text-[#4b765a]">New Gemini agent</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">What should this agent know?</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close topic agent creator" className="grid size-9 place-items-center rounded hover:bg-[#edf3ea]"><X size={19} /></button>
        </div>

        <label
          className={`mt-6 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-4 text-center transition ${
            dropping
              ? "scale-[1.01] border-[#2d7246] bg-[#e4f1df]"
              : "border-[#9fbea5] bg-[#f2f8ef] hover:border-[#4d865e] hover:bg-[#ebf5e8]"
          }`}
        >
          {file ? <FileText size={26} className="mb-2 text-[#2d7246]" /> : <Upload size={26} className="mb-2 text-[#2d7246]" />}
          <span className="max-w-full truncate text-sm font-semibold">
            {dropping ? "Drop your PDF here" : file?.name || "Upload a PDF, or drop one in"}
          </span>
          <span className="mt-1 text-xs text-[#667b6d]">Gemini reads the title and contents to name the agent</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
            }}
          />
        </label>
        {file && (
          <button type="button" onClick={() => setFile(null)} className="mt-2 text-xs font-semibold text-[#8f2f23] hover:underline">
            Remove {file.name}
          </button>
        )}

        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-[#8ba292]">
          <span className="h-px flex-1 bg-[#d4dfd1]" />or describe a topic<span className="h-px flex-1 bg-[#d4dfd1]" />
        </div>

        <label htmlFor="agent-topic" className="block text-sm font-bold text-[#294a35]">Agent topic</label>
        <input
          ref={input}
          id="agent-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          maxLength={160}
          disabled={Boolean(file)}
          placeholder="e.g. Car agreement"
          className="mt-2 h-12 w-full rounded-md border border-[#b7cbb5] bg-white px-3 text-base outline-none focus:border-[#4f865e] focus:ring-2 focus:ring-[#c4dfc9] disabled:bg-[#f2f4f1] disabled:text-[#93a398]"
        />
        <p className="mt-2 text-xs leading-5 text-[#65796b]">
          {file
            ? "The uploaded PDF will be used. Remove it to create a topic agent instead."
            : "Gemini will name the agent, choose its garden object, and prepare its first conversation."}
        </p>
        {error && <p role="alert" className="mt-3 rounded-md bg-[#fff0ed] px-3 py-2 text-sm text-[#a43b32]">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className="h-10 rounded-md border border-[#cad8c7] px-4 text-sm font-semibold hover:bg-[#f0f4ee]">Cancel</button>
          <button type="submit" disabled={(!file && topic.trim().length < 3) || creating} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white hover:bg-[#184b2d] disabled:cursor-not-allowed disabled:opacity-50">
            {creating && <LoaderCircle size={17} className="animate-spin" />}
            {creating ? (file ? "Reading document..." : "Growing agent...") : "Create agent"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
