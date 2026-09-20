"use client";

import { Plus } from "lucide-react";
import { openTopicAgent } from "@/components/agents/CreateTopicModal";

export function CreateAgentObject() {
  return (
    <button
      type="button"
      onClick={openTopicAgent}
      className="group flex flex-col items-center text-center focus-visible:outline-none"
    >
      <span className="grid size-16 place-items-center rounded-lg border-2 border-dashed border-[#477b52] bg-[#f1f8ed]/90 text-[#2c673d] transition group-hover:-translate-y-1 group-hover:bg-white group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#265f3b] motion-reduce:transform-none">
        <Plus size={30} aria-hidden="true" />
      </span>
      <span className="mt-2 rounded bg-[#fffef9]/95 px-2 py-1 text-xs font-bold text-[#27583a] shadow-sm ring-1 ring-[#d6e1d2]">Create a new agent</span>
    </button>
  );
}
