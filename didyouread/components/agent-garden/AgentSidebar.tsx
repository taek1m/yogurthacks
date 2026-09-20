"use client";

import { useEffect, useState } from "react";
import { agentIconMap } from "@/components/agent-garden/agentIconMap";
import { AGENTS_TOGGLE_EVENT } from "@/components/agent-garden/gardenEvents";
import type { DocumentAgent } from "@/types/agent";

/**
 * The garden's index. Searching lives in the header; this is just the list, and
 * picking one sends it up into the spotlight.
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

  useEffect(() => {
    const toggle = (event: Event) => setOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(AGENTS_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(AGENTS_TOGGLE_EVENT, toggle);
  }, []);

  // Clicking anywhere outside puts the list away, except on the header's own
  // button, which would otherwise close and reopen in one press.
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Grabbing an agent must not collapse the list: the garden would shift
      // sideways mid-drag and the character would jump out from under the cursor.
      if (
        target.closest("[data-agent-list]") ||
        target.closest("[data-agents-toggle]") ||
        target.closest("[data-agent-object]")
      ) return;
      window.dispatchEvent(new CustomEvent(AGENTS_TOGGLE_EVENT, { detail: false }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.dispatchEvent(new CustomEvent(AGENTS_TOGGLE_EVENT, { detail: false }));
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      data-agent-list
      aria-label="Agent list"
      className="z-20 flex shrink-0 flex-col border-b border-[#cfe0e6] bg-[#eaf4f7] md:w-72 md:border-b-0 md:border-r"
    >
      <p className="px-4 pb-2 pt-4 text-xs font-bold uppercase text-[#3f6b7a]">Your agents ({agents.length})</p>

      <div className="max-h-56 flex-1 overflow-y-auto px-3 pb-4 md:max-h-none">
        {agents.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[#5d7986]">No agents yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {agents.map((agent) => {
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
      </div>
    </aside>
  );
}
