"use client";

import { PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { DocumentHighlights } from "@/components/agents/DocumentHighlights";
import type { HighlightedDocument } from "@/lib/document-highlights";

/**
 * Holds the chat beside the marked-up document and lets the reader collapse the
 * document panel to give the conversation the full width.
 */
export function AgentWorkspace({
  chat,
  document: highlighted,
  documentName,
  documentNames,
}: {
  chat: ReactNode;
  document: HighlightedDocument | null;
  documentName: string;
  documentNames?: string[];
}) {
  const [open, setOpen] = useState(true);

  if (!highlighted) {
    return <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1">{chat}</div>;
  }

  const marks = highlighted.marks.length;

  return (
    <div
      className={`mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 ${
        open ? "lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]" : "lg:grid-cols-[minmax(0,1fr)_auto]"
      }`}
    >
      {chat}
      {open ? (
        <DocumentHighlights
          document={highlighted}
          documentName={documentName}
          documentNames={documentNames}
          onHide={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex items-center justify-center gap-2 border-t border-[#d4dfd1] bg-[#f3f7ef] px-4 py-3 text-sm font-bold text-[#2d5640] hover:bg-[#e9f2e4] lg:w-12 lg:flex-col lg:border-l lg:border-t-0 lg:py-5"
        >
          <PanelRightOpen size={18} />
          <span className="lg:[writing-mode:vertical-rl]">
            Show highlights{marks > 0 ? ` (${marks})` : ""}
          </span>
        </button>
      )}
    </div>
  );
}
