"use client";

import { Camera, FileText, ImageIcon, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MAX_PHOTOS,
  UNSUPPORTED_UPLOAD_MESSAGE,
  UPLOAD_ACCEPT,
  isPdfFile,
  isPhotoFile,
  isSupportedUpload,
} from "@/lib/upload-kinds";

const eventName = "agent-garden:create-topic-agent";

export function openTopicAgent() {
  window.dispatchEvent(new Event(eventName));
}

export function CreateTopicModal() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  // A PDF arrives on its own; photographed pages arrive as a set.
  const [files, setFiles] = useState<File[]>([]);
  const [dropping, setDropping] = useState(false);
  // dragenter/dragleave also fire for children, so count them instead of toggling.
  const dragDepth = useRef(0);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
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

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  /**
   * Keeps one PDF, or a set of photos. Mixing the two would have to be split
   * into two agents, so the newest pick simply replaces the other kind.
   */
  function accept(picked: File[]) {
    const supported = picked.filter(isSupportedUpload);
    if (supported.length === 0) {
      setError(picked.length ? UNSUPPORTED_UPLOAD_MESSAGE : "That drop had no file in it.");
      return;
    }
    const pdf = supported.find(isPdfFile);
    if (pdf) {
      setFiles([pdf]);
      setError(supported.length > 1 ? "A PDF is read on its own, so only that file was kept." : "");
      return;
    }
    const photos = supported.filter(isPhotoFile);
    setFiles((current) => {
      const kept = current.every(isPhotoFile) ? current : [];
      // The same photo picked twice would become two identical pages.
      const fresh = photos.filter(
        (photo) => !kept.some((held) => held.name === photo.name && held.size === photo.size),
      );
      const merged = [...kept, ...fresh].slice(0, MAX_PHOTOS);
      setError(
        kept.length + fresh.length > MAX_PHOTOS
          ? `Up to ${MAX_PHOTOS} photos can be read at once.`
          : supported.length > photos.length
            ? UNSUPPORTED_UPLOAD_MESSAGE
            : "",
      );
      return merged;
    });
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
    accept(Array.from(event.dataTransfer.files));
  }

  function close() {
    if (creating) return;
    setOpen(false);
    setError("");
    setFiles([]);
    setDropping(false);
    dragDepth.current = 0;
  }

  /** Uploading a document creates a document agent, named after what it holds. */
  async function createFromUpload(picked: File[]) {
    const body = new FormData();
    for (const picked_file of picked) body.append("document", picked_file);
    const response = await fetch("/api/agents", { method: "POST", body });
    const result = (await response.json()) as { agent?: { id: string }; error?: string };
    if (!response.ok || !result.agent) throw new Error(result.error || "The document could not be analyzed");
    return result.agent.id;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = topic.trim();
    if (files.length === 0 && value.length < 3) {
      return setError("Upload a PDF or a photo, or enter a topic with at least 3 characters.");
    }
    const pdf = files.find(isPdfFile);
    if (pdf && pdf.size > 5 * 1024 * 1024) return setError("PDFs must be 5 MB or smaller.");
    if (files.some((picked) => isPhotoFile(picked) && picked.size > 8 * 1024 * 1024)) {
      return setError("Photos must be 8 MB or smaller.");
    }

    setCreating(true);
    setError("");
    try {
      let agentId: string;
      if (files.length > 0) {
        agentId = await createFromUpload(files);
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
      setFiles([]);
      window.dispatchEvent(new Event("agent-garden:changed"));
      router.push(`/agents/${agentId}`);
      router.refresh();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Agent creation failed");
    } finally {
      setCreating(false);
    }
  }

  const photosPicked = files.length > 0 && files.every(isPhotoFile);

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
            <p className="text-xs font-bold uppercase text-[#4b765a]">New agent</p>
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
          {files.length === 0 ? (
            <Upload size={26} className="mb-2 text-[#2d7246]" />
          ) : photosPicked ? (
            <ImageIcon size={26} className="mb-2 text-[#2d7246]" />
          ) : (
            <FileText size={26} className="mb-2 text-[#2d7246]" />
          )}
          <span className="max-w-full truncate text-sm font-semibold">
            {dropping
              ? "Drop it here"
              : files.length === 0
                ? "Upload a PDF or a photo, or drop one in"
                : photosPicked
                  ? `${files.length} photo${files.length === 1 ? "" : "s"} ready`
                  : files[0].name}
          </span>
          <span className="mt-1 text-xs text-[#667b6d]">
            The agent reads the contents to name itself. Photos of paper are read too.
          </span>
          <input
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              accept(Array.from(event.target.files ?? []));
              // Let the same file be picked again after it is removed.
              event.target.value = "";
            }}
          />
        </label>

        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#b7cbb5] bg-white px-3 py-2 text-sm font-semibold text-[#225f3b] hover:bg-[#eef6ec]">
          <Camera size={17} />
          {photosPicked ? "Take another photo" : "Take a photo of the document"}
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              accept(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>

        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((picked, index) => (
              <li key={`${picked.name}-${picked.size}`} className="flex items-center gap-2 rounded bg-[#f2f8ef] px-2 py-1.5 text-xs">
                {photosPicked && <span className="font-bold text-[#4b765a]">Page {index + 1}</span>}
                <span className="min-w-0 flex-1 truncate text-[#33513f]">{picked.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((held) => held !== picked))}
                  aria-label={`Remove ${picked.name}`}
                  className="shrink-0 rounded p-0.5 text-[#8f2f23] hover:bg-[#fbe6e2]"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
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
          disabled={files.length > 0}
          placeholder="e.g. Car agreement"
          className="mt-2 h-12 w-full rounded-md border border-[#b7cbb5] bg-white px-3 text-base outline-none focus:border-[#4f865e] focus:ring-2 focus:ring-[#c4dfc9] disabled:bg-[#f2f4f1] disabled:text-[#93a398]"
        />
        <p className="mt-2 text-xs leading-5 text-[#65796b]">
          {files.length > 0
            ? photosPicked
              ? "The photos will be read, in the order listed. Remove them to create a topic agent instead."
              : "The uploaded PDF will be used. Remove it to create a topic agent instead."
            : "The agent will name itself, choose its garden object, and prepare its first conversation."}
        </p>
        {error && <p role="alert" className="mt-3 rounded-md bg-[#fff0ed] px-3 py-2 text-sm text-[#a43b32]">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className="h-10 rounded-md border border-[#cad8c7] px-4 text-sm font-semibold hover:bg-[#f0f4ee]">Cancel</button>
          <button type="submit" disabled={(files.length === 0 && topic.trim().length < 3) || creating} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#225f3b] px-4 text-sm font-semibold text-white hover:bg-[#184b2d] disabled:cursor-not-allowed disabled:opacity-50">
            {creating && <LoaderCircle size={17} className="animate-spin" />}
            {creating
              ? photosPicked
                ? "Reading the photos..."
                : files.length > 0
                  ? "Reading document..."
                  : "Growing agent..."
              : "Create agent"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
