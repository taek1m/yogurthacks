import { FileText, MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { AgentSearchResult } from "@/types/agent";

export function SearchResults({ results, state }: { results: AgentSearchResult; state: "loading" | "ready" | "error" }) {
  const hasResults = results.agents.length > 0 || results.messages.length > 0;
  return (
    <div id="global-search-results" role="region" aria-live="polite" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-md border border-[#d5e0d1] bg-white p-2 shadow-xl">
      {state === "loading" && <p className="p-4 text-sm text-[#65796b]">Searching...</p>}
      {state === "error" && <p className="p-4 text-sm text-[#a43b32]">Search is unavailable. Please try again.</p>}
      {state === "ready" && !hasResults && <p className="p-4 text-sm text-[#65796b]">No matching agents or messages.</p>}
      {state === "ready" && results.agents.length > 0 && (
        <section aria-labelledby="agent-results-title">
          <h2 id="agent-results-title" className="px-3 pb-1 pt-2 text-xs font-bold uppercase text-[#708477]">Agents</h2>
          {results.agents.map((agent) => (
            <Link key={agent.agentId} href={`/agents/${agent.agentId}`} className="flex items-start gap-3 rounded px-3 py-2 hover:bg-[#eef6ec] focus-visible:outline-2 focus-visible:outline-[#327a4a]">
              <FileText size={17} className="mt-0.5 shrink-0 text-[#39734c]" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#183126]">{agent.agentName}</span><span className="block truncate text-xs text-[#65796b]">{agent.documentName}</span></span>
            </Link>
          ))}
        </section>
      )}
      {state === "ready" && results.messages.length > 0 && (
        <section aria-labelledby="message-results-title" className="mt-1 border-t border-[#e3ebe0] pt-1">
          <h2 id="message-results-title" className="px-3 pb-1 pt-2 text-xs font-bold uppercase text-[#708477]">Messages</h2>
          {results.messages.map((message) => (
            <Link key={message.messageId} href={`/agents/${message.agentId}?message=${message.messageId}`} className="flex items-start gap-3 rounded px-3 py-2 hover:bg-[#eef6ec] focus-visible:outline-2 focus-visible:outline-[#327a4a]">
              <MessageSquareText size={17} className="mt-0.5 shrink-0 text-[#9b6430]" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#183126]">{message.agentName}</span><span className="line-clamp-2 text-xs leading-5 text-[#65796b]">{message.excerpt}</span></span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
