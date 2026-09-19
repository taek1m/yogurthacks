"use client";

import { LoaderCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AgentMessage, DocumentAgent } from "@/types/agent";

export function AgentChat({ agent, highlightedMessage }: { agent: DocumentAgent; highlightedMessage?: string }) {
  const [messages, setMessages] = useState(agent.messages);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedMessage) {
      document.getElementById(`message-${highlightedMessage}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessage]);

  async function ask(event: React.FormEvent) {
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
    <section className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#fffef9] lg:border-r lg:border-[#dce5d9]" aria-labelledby="agent-title">
      <header className="border-b border-[#dce5d9] px-5 py-5 sm:px-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-md bg-[#e5f1df] text-[#347049]"><Sparkles size={20} /></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#4c765a]">{agent.sourceKind === "topic" ? "Topic agent" : "Document agent"}</p>
            <h1 id="agent-title" className="truncate font-display text-2xl font-semibold text-[#173c28] sm:text-3xl">{agent.name}</h1>
            <p className="truncate text-sm text-[#687a6e]">{agent.documentName}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.map((message) => {
          const highlighted = message.id === highlightedMessage;
          return (
            <article
              id={`message-${message.id}`}
              key={message.id}
              className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm transition ${message.role === "user" ? "ml-auto bg-[#275f3c] text-white" : "border border-[#dbe5d8] bg-white text-[#283d31]"} ${highlighted ? "ring-3 ring-[#e6b84e]" : ""}`}
            >
              <p>{message.content}</p>
              <time className={`mt-1 block text-[11px] ${message.role === "user" ? "text-white/70" : "text-[#7b897f]"}`}>{new Date(message.createdAt).toLocaleString()}</time>
            </article>
          );
        })}
        <div ref={end} />
      </div>

      <form onSubmit={ask} className="sticky bottom-0 border-t border-[#dce5d9] bg-[#fffef9] p-4 sm:px-8">
        <label className="sr-only" htmlFor="agent-question">Ask this agent a question</label>
        <div className="flex items-end gap-2 rounded-lg border border-[#bdcdb9] bg-white p-2 shadow-sm focus-within:border-[#5b9069] focus-within:ring-2 focus-within:ring-[#c4dfc9]">
          <textarea id="agent-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} placeholder={agent.sourceKind === "topic" ? `Ask about ${agent.topic || "this topic"}...` : "Ask about a deadline, fee, or clause..."} className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" />
          <button type="submit" disabled={!question.trim() || sending} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-md bg-[#225f3b] text-white hover:bg-[#184b2d] disabled:opacity-40">
            {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-[#a43b32]">{error}</p>}
      </form>
    </section>
  );
}
