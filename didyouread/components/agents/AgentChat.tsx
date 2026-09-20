"use client";

import { FileText, LoaderCircle, Paperclip, Send, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentSummary } from "@/components/agents/AgentSummary";
import type { AgentMessage, DocumentAgent } from "@/types/agent";

export function AgentChat({ agent, highlightedMessage }: { agent: DocumentAgent; highlightedMessage?: string }) {
  const [messages, setMessages] = useState(agent.messages);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [documentNames, setDocumentNames] = useState(agent.documentNames ?? [agent.documentName]);
  const [attaching, setAttaching] = useState(false);
  const [dropping, setDropping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // dragenter/dragleave also fire for children, so count them instead of toggling.
  const dragDepth = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (highlightedMessage) {
      document.getElementById(`message-${highlightedMessage}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessage]);

  function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
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
    const files = Array.from(event.dataTransfer.files);
    const pdf = files.find(isPdf);
    if (!pdf) {
      setError(files.length ? "Only PDF documents can be added to an agent." : "That drop had no file in it.");
      return;
    }
    if (files.length > 1) setError("Only the first PDF was added.");
    void attach(pdf);
  }

  /** Attaches another PDF so this agent answers from it too. */
  async function attach(file: File) {
    setAttaching(true);
    setError("");
    const body = new FormData();
    body.set("document", file);
    try {
      const response = await fetch(`/api/agents/${agent.id}/documents`, { method: "POST", body });
      const result = (await response.json()) as { agent?: DocumentAgent; message?: AgentMessage; error?: string };
      if (!response.ok || !result.agent || !result.message) throw new Error(result.error || "The PDF could not be added");
      setMessages((current) => [...current, result.message!]);
      setDocumentNames(result.agent.documentNames ?? [result.agent.documentName]);
      window.dispatchEvent(new Event("agent-garden:changed"));
      // Repaint the marked-up panel, which is rendered on the server.
      router.refresh();
      window.setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "The PDF could not be added");
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
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/agents/${agent.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = (await response.json()) as { messages?: AgentMessage[]; error?: string };
      if (!response.ok || !result.messages) throw new Error(result.error || "Message failed");
      setMessages((current) => [...current, ...result.messages!]);
      setQuestion("");
      window.setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="relative flex min-h-[calc(100vh-4rem)] min-w-0 flex-col bg-[#fffef9] lg:border-r lg:border-[#dce5d9]"
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

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
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
        <div ref={end} />
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
              Drop your PDF here to add it to this agent
            </div>
          )}
          <input
            ref={filePicker}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void attach(file);
            }}
          />
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            disabled={attaching}
            title="Attach another PDF to this agent"
            aria-label="Attach another PDF to this agent"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-[#cad8c7] text-[#2d5640] hover:bg-[#eef6ec] disabled:opacity-40"
          >
            {attaching ? <LoaderCircle size={18} className="animate-spin" /> : <Paperclip size={18} />}
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
