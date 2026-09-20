"use client";

import { PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DocumentHighlights } from "@/components/agents/DocumentHighlights";
import type { HighlightedDocument } from "@/lib/document-highlights";
import type { HighlightOverride } from "@/types/agent";

/**
 * Holds the chat beside the marked-up document and lets the reader collapse the
 * document panel to give the conversation the full width.
 */
export function AgentWorkspace({
  agentId,
  chat,
  document: highlighted,
  documentName,
  documentNames,
  highlightOverrides,
  hiddenPages,
  hiddenPageAt,
}: {
  agentId: string;
  chat: ReactNode;
  document: HighlightedDocument | null;
  documentName: string;
  documentNames?: string[];
  highlightOverrides?: Record<string, HighlightOverride>;
  hiddenPages?: number[];
  hiddenPageAt?: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  if (!highlighted) {
    return <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1">{chat}</div>;
  }

  const marks = highlighted.marks.length;

  return (
    <div
      className={`relative mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 ${
        open ? "lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]" : ""
      }`}
    >
      {chat}
      {open ? (
        <DocumentHighlights
          agentId={agentId}
          document={highlighted}
          documentName={documentName}
          documentNames={documentNames}
          overrides={highlightOverrides}
          removedPages={hiddenPages}
          removedPageAt={hiddenPageAt}
          onReread={() => router.refresh()}
          onHide={() => setOpen(false)}
        />
      ) : (
        // Sits where the panel's own Hide button was, so the pair swap in place.
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="absolute right-5 top-5 z-30 inline-flex items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d5640] shadow-sm hover:bg-[#eef6ec] sm:right-7"
        >
          <PanelRightOpen size={14} />
          Show highlights{marks > 0 ? ` (${marks})` : ""}
        </button>
      )}
    </div>
  );
}
