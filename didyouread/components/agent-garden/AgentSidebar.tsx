"use client";

import { LoaderCircle, PanelLeftClose, PanelLeftOpen, Search, Sprout, X } from "lucide-react";
import { useEffect, useState } from "react";
import { agentIconMap } from "@/components/agent-garden/agentIconMap";
import type { AgentSearchResult, DocumentAgent } from "@/types/agent";

/**
 * The garden's index: every agent in a list, searchable by name, file name, or
 * anything said in its conversation. Picking one spotlights it in the garden.
 */
export function AgentSidebar({
  agents,
  selectedId,
  onSelect,
}: {
  agents: DocumentAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AgentSearchResult["messages"]>([]);
  const [searching, setSearching] = useState(false);

  const term = query.trim().toLowerCase();
  // Names and file names are already on the client, so filter them instantly.
  const listed = term
    ? agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(term) ||
          agent.documentName.toLowerCase().includes(term) ||
          (agent.documentNames ?? []).some((name) => name.toLowerCase().includes(term)),
      )
    : agents;

  // Conversation text lives on the server, so that half of the search is fetched.
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const result = (await response.json()) as AgentSearchResult;
        setMatches(result.messages ?? []);
      } catch {
        // An aborted or failed search just leaves the name matches on screen.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const listedIds = new Set(listed.map((agent) => agent.id));
  // Results from a previous, longer query must not linger once the box is cleared.
  const extraHits = term.length < 2 ? [] : matches.filter((match) => !listedIds.has(match.agentId));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="z-20 flex shrink-0 items-center justify-center gap-2 border-b border-[#cfe0e6] bg-[#eaf4f7] px-4 py-3 text-sm font-bold text-[#2d5640] hover:bg-[#ddecf1] md:w-12 md:flex-col md:border-b-0 md:border-r md:py-5"
      >
        <PanelLeftOpen size={18} />
        <span className="md:[writing-mode:vertical-rl]">Agents ({agents.length})</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Agent list"
      className="z-20 flex shrink-0 flex-col border-b border-[#cfe0e6] bg-[#eaf4f7] md:w-72 md:border-b-0 md:border-r"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="text-xs font-bold uppercase text-[#3f6b7a]">Your agents ({agents.length})</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          aria-label="Hide the agent list"
          className="grid size-7 place-items-center rounded hover:bg-[#d8e9ef]"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="relative px-4 pb-3 pt-2">
        <Search size={15} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-[#6d8896]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents or chats..."
          aria-label="Search agents by name or conversation"
          className="h-10 w-full rounded-md border border-[#b9d2db] bg-white pl-8 pr-8 text-sm outline-none focus:border-[#4f865e] focus:ring-2 focus:ring-[#c4dfc9]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear the search"
            className="absolute right-6 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded hover:bg-[#dbe9ee]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="max-h-56 flex-1 overflow-y-auto px-3 pb-4 md:max-h-none">
        {listed.length === 0 && extraHits.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[#5d7986]">
            {searching ? "Searching..." : term ? `Nothing matches “${query.trim()}”.` : "No agents yet."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {listed.map((agent) => {
              const Icon = agentIconMap[agent.documentType].icon;
              const active = agent.id === selectedId;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(agent.id)}
                    aria-current={active}
                    className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition ${
                      active
                        ? "border-[#8fb497] bg-white shadow-sm ring-2 ring-[#c4dfc9]"
                        : "border-transparent hover:border-[#bcd6df] hover:bg-white/70"
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[#2d5640] ring-1 ring-[#cfe0e6]">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[#173c28]">{agent.name}</span>
                      <span className="block truncate text-xs text-[#5d7986]">{agent.documentName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {extraHits.length > 0 && (
          <div className="mt-4 border-t border-[#cfe0e6] pt-3">
            <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-bold uppercase text-[#3f6b7a]">
              <Sprout size={13} />
              Found in conversations
            </p>
            <ul className="space-y-1.5">
              {extraHits.map((match) => (
                <li key={match.messageId}>
                  <button
                    type="button"
                    onClick={() => onSelect(match.agentId)}
                    className="w-full rounded-md border border-transparent px-2.5 py-2 text-left hover:border-[#bcd6df] hover:bg-white/70"
                  >
                    <span className="block truncate text-sm font-bold text-[#173c28]">{match.agentName}</span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[#5d7986]">{match.excerpt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searching && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#5d7986]">
            <LoaderCircle size={12} className="animate-spin" />
            Searching conversations...
          </p>
        )}
      </div>
    </aside>
  );
}
