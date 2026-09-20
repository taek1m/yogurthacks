"use client";

import { Camera, FileText, LoaderCircle, Paperclip, Send, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentSummary } from "@/components/agents/AgentSummary";
import { notifyTodosChanged } from "@/components/navigation/HeaderPanels";
import {
  MAX_PHOTOS,
  UNSUPPORTED_UPLOAD_MESSAGE,
  UPLOAD_ACCEPT,
  isPdfFile,
  isPhotoFile,
  isSupportedUpload,
} from "@/lib/upload-kinds";
import type { AgentMessage, DocumentAgent } from "@/types/agent";

export function AgentChat({ agent, highlightedMessage }: { agent: DocumentAgent; highlightedMessage?: string }) {
  const [messages, setMessages] = useState(agent.messages);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [documentNames, setDocumentNames] = useState(agent.documentNames ?? [agent.documentName]);
  const [attaching, setAttaching] = useState(false);
  const [dropping, setDropping] = useState(false);
  const stream = useRef<HTMLDivElement>(null);
  // dragenter/dragleave also fire for children, so count them instead of toggling.
  const dragDepth = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const cameraPicker = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Remember that this chat was opened, so the search bar can offer it back.
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/agents/${agent.id}/visit`, { method: "POST", signal: controller.signal }).catch(
      () => {},
    );
    return () => controller.abort();
  }, [agent.id]);

  useEffect(() => {
    if (highlightedMessage) {
      document.getElementById(`message-${highlightedMessage}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessage]);

  /**
   * Scrolls the message list itself. scrollIntoView would drag every scrollable
   * ancestor along with it, which yanks the whole page to the top.
   */
  function scrollToLatest(smooth = true) {
    const list = stream.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function onDragEnter(event: React.DragEvent) {
    if (!hasFiles(event)) return;
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
    if (attaching) return;
    void attach(Array.from(event.dataTransfer.files));
  }

  /** Keeps one PDF, or a run of photographed pages that become one document. */
  function pickFiles(picked: File[]): File[] | null {
    const supported = picked.filter(isSupportedUpload);
    if (supported.length === 0) {
      setError(picked.length ? UNSUPPORTED_UPLOAD_MESSAGE : "That drop had no file in it.");
      return null;
    }
    const pdf = supported.find(isPdfFile);
    if (pdf) {
      setError(supported.length > 1 ? "A PDF is read on its own, so only that file was added." : "");
      return [pdf];
    }
    const photos = supported.filter(isPhotoFile).slice(0, MAX_PHOTOS);
    setError(
      supported.length > photos.length ? `Up to ${MAX_PHOTOS} photos can be read at once.` : "",
    );
    return photos;
  }

  /** Attaches another PDF, or photographed pages, so this agent answers from it too. */
  async function attach(picked: File[]) {
    const files = pickFiles(picked);
    if (!files) return;
    setAttaching(true);
    const body = new FormData();
    for (const file of files) body.append("document", file);
    try {
      const response = await fetch(`/api/agents/${agent.id}/documents`, { method: "POST", body });
      const result = (await response.json()) as { agent?: DocumentAgent; message?: AgentMessage; error?: string };
      if (!response.ok || !result.agent || !result.message) throw new Error(result.error || "The document could not be added");
      setMessages((current) => [...current, result.message!]);
      setDocumentNames(result.agent.documentNames ?? [result.agent.documentName]);
      window.dispatchEvent(new Event("agent-garden:changed"));
      // Repaint the marked-up panel, which is rendered on the server.
      router.refresh();
      window.setTimeout(() => scrollToLatest(), 50);
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "The document could not be added");
    } finally {
      setAttaching(false);
    }
  }

  /** Enter sends; Shift+Enter (or an IME still composing) keeps the newline. */
  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void ask(event);
  }

  async function ask(event: React.FormEvent | React.KeyboardEvent) {
    event.preventDefault();
    const content = question.trim();
    if (!content || sending) return;

    // Show the question straight away and let the agent think out loud, rather
    // than holding the message back until the whole reply has arrived.
    const pendingId = `pending-${crypto.randomUUID()}`;
    const pending: AgentMessage = {
      id: pendingId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, pending]);
    setQuestion("");
    setSending(true);
    setError("");
    window.setTimeout(() => scrollToLatest(), 30);

    try {
      const response = await fetch(`/api/agents/${agent.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = (await response.json()) as { messages?: AgentMessage[]; todos?: unknown[]; error?: string };
      if (!response.ok || !result.messages) throw new Error(result.error || "Message failed");
      // Swap the local copy for the saved pair, which carries the real ids.
      setMessages((current) => [...current.filter((message) => message.id !== pendingId), ...result.messages!]);
      // The agent may have put something on the reader's list while answering.
      if (result.todos?.length) notifyTodosChanged();
      window.setTimeout(() => scrollToLatest(), 50);
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      setQuestion(content);
      setError(sendError instanceof Error ? sendError.message : "Message failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="relative flex h-[calc(100vh-4rem)] min-w-0 flex-col bg-[#fffef9] lg:border-r lg:border-[#dce5d9]"
      aria-labelledby="agent-title"
      onDragEnter={onDragEnter}
      onDragOver={(event) => { if (hasFiles(event)) event.preventDefault(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >

      <header className="border-b border-[#dce5d9] px-5 py-5 sm:px-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-md bg-[#e5f1df] text-[#347049]"><Sparkles size={20} /></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#4c765a]">{agent.sourceKind === "topic" ? "Topic agent" : "Document agent"}</p>
            <h1 id="agent-title" className="truncate font-display text-2xl font-semibold text-[#173c28] sm:text-3xl">{agent.name}</h1>
            <p className="truncate text-sm text-[#687a6e]">
              {documentNames[0]}
              {documentNames.length > 1 && (
                <span className="ml-1 font-semibold text-[#4c765a]">+{documentNames.length - 1} more</span>
              )}
            </p>
          </div>
        </div>
      </header>

      <AgentSummary
        analysis={agent.analysis}
        sourceKind={agent.sourceKind}
        onAskQuestion={(value) => {
          setQuestion(value);
          input.current?.focus();
        }}
      />

      <div ref={stream} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.map((message) => {
          const highlighted = message.id === highlightedMessage;
          return (
            <article
              id={`message-${message.id}`}
              key={message.id}
              className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm transition ${message.role === "user" ? "ml-auto bg-[#275f3c] text-white" : "border border-[#dbe5d8] bg-white text-[#283d31]"} ${highlighted ? "ring-3 ring-[#e6b84e]" : ""}`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <time className={`mt-1 block text-[11px] ${message.role === "user" ? "text-white/70" : "text-[#7b897f]"}`}>{new Date(message.createdAt).toLocaleString()}</time>
            </article>
          );
        })}
        {sending && (
          <article className="max-w-[88%] rounded-lg border border-[#dbe5d8] bg-white px-4 py-3 shadow-sm" aria-live="polite">
            <span className="sr-only">{agent.name} is writing a reply</span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-[#7d9585] [animation:chatDot_1.1s_ease-in-out_infinite]" />
              <span className="size-2 rounded-full bg-[#7d9585] [animation:chatDot_1.1s_0.18s_ease-in-out_infinite]" />
              <span className="size-2 rounded-full bg-[#7d9585] [animation:chatDot_1.1s_0.36s_ease-in-out_infinite]" />
            </span>
          </article>
        )}
      </div>

      <form onSubmit={ask} className="sticky bottom-0 border-t border-[#dce5d9] bg-[#fffef9] p-4 sm:px-8">
        <label className="sr-only" htmlFor="agent-question">Ask this agent a question</label>
        <div
          className={`relative flex items-end gap-2 rounded-lg border p-2 shadow-sm transition ${
            dropping
              ? "border-2 border-dashed border-[#4d865e] bg-[#eef6ec]"
              : "border-[#bdcdb9] bg-white focus-within:border-[#5b9069] focus-within:ring-2 focus-within:ring-[#c4dfc9]"
          }`}
        >
          {dropping && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-[#eef6ec] text-sm font-bold text-[#22613c]">
              <Upload size={18} />
              Drop a PDF or a photo here to add it to this agent
            </div>
          )}
          <input
            ref={filePicker}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length) void attach(picked);
            }}
          />
          <input
            ref={cameraPicker}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length) void attach(picked);
            }}
          />
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            disabled={attaching}
            title="Attach a PDF or a photo to this agent"
            aria-label="Attach a PDF or a photo to this agent"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-[#cad8c7] text-[#2d5640] hover:bg-[#eef6ec] disabled:opacity-40"
          >
            {attaching ? <LoaderCircle size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </button>
          <button
            type="button"
            onClick={() => cameraPicker.current?.click()}
            disabled={attaching}
            title="Photograph a page and add it to this agent"
            aria-label="Photograph a page and add it to this agent"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-[#cad8c7] text-[#2d5640] hover:bg-[#eef6ec] disabled:opacity-40"
          >
            <Camera size={18} />
          </button>
          <textarea id="agent-question" ref={input} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onComposerKeyDown} rows={2} placeholder={agent.sourceKind === "topic" ? `Ask about ${agent.topic || "this topic"}...` : "Ask about a deadline, fee, or clause..."}
            aria-describedby="composer-hint" className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" />
          <button type="submit" disabled={!question.trim() || sending} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-md bg-[#225f3b] text-white hover:bg-[#184b2d] disabled:opacity-40">
            {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p id="composer-hint" className="sr-only">Press Enter to send, Shift and Enter for a new line.</p>
        {attaching && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#4c765a]">
            <FileText size={13} />
            Reading the new document...
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-[#a43b32]">{error}</p>}
      </form>
    </section>
  );
}
