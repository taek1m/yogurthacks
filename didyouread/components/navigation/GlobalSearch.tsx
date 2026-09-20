"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { requestSpotlight } from "@/components/agent-garden/gardenEvents";
import { SearchResults } from "@/components/navigation/SearchResults";
import type { AgentSearchResult } from "@/types/agent";

const emptyResults: AgentSearchResult = { agents: [], messages: [] };
/** How long a fetched shortlist is reused before the next focus refetches it. */
const RECENT_MAX_AGE_MS = 30000;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(emptyResults);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "recent" | "error">("idle");
  const [recent, setRecent] = useState<AgentSearchResult["agents"]>([]);
  const recentLoadedAt = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setState("idle");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        setResults((await response.json()) as AgentSearchResult);
        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  /**
   * Offers the agents whose chats were opened most recently, so the commonest
   * reason to reach for search — going back to what you were just reading —
   * takes no typing at all.
   */
  async function showRecent() {
    setState("recent");
    if (Date.now() - recentLoadedAt.current < RECENT_MAX_AGE_MS) return;
    try {
      const response = await fetch("/api/agents/recent");
      if (!response.ok) throw new Error("Recent agents failed");
      const result = (await response.json()) as { agents: AgentSearchResult["agents"] };
      recentLoadedAt.current = Date.now();
      setRecent(result.agents);
    } catch {
      // A missing shortlist is not worth an error message; search still works.
      setRecent([]);
    }
  }

  /** Send the agent up into the spotlight instead of opening its chat. */
  function pickAgent(agentId: string) {
    setQuery("");
    setResults(emptyResults);
    setState("idle");
    // This agent has just jumped to the top of the shortlist.
    recentLoadedAt.current = 0;
    requestSpotlight(agentId);
    if (pathname !== "/") router.push("/");
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(emptyResults);
      void showRecent();
    }
  }

  return (
    <div ref={container} className="relative mx-auto w-full max-w-2xl">
      <label className="relative block">
        <span className="sr-only">Search agent names or conversations</span>
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#668070]" />
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => (query.trim().length >= 2 ? setState("ready") : void showRecent())}
          placeholder="Search agent names or conversations..."
          aria-expanded={state !== "idle"}
          aria-controls="global-search-results"
          className="h-10 w-full rounded-md border border-[#d5e0d1] bg-[#f7faf5] pl-9 pr-9 text-sm text-[#193427] outline-none transition placeholder:text-[#708477] focus:border-[#6fa47d] focus:bg-white focus:ring-2 focus:ring-[#b8d8bf]"
        />
        {state === "loading" ? (
          <LoaderCircle size={17} aria-label="Searching" className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#48755a]" />
        ) : query ? (
          <button type="button" aria-label="Clear search" onClick={() => updateQuery("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-[#668070] hover:bg-[#e8f0e6]"><X size={16} /></button>
        ) : null}
      </label>
      {state !== "idle" && (
        <SearchResults results={results} recent={recent} state={state} onPickAgent={pickAgent} />
      )}
    </div>
  );
}
