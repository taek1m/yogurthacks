"use client";

import { CalendarPlus, ChevronDown, DollarSign, CircleCheck, HelpCircle, ScrollText, TriangleAlert } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { AgentAnalysis } from "@/types/agent";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  // The server has no viewport, so it renders the wide layout and hydration corrects it.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
}

/**
 * The plain-language read of the document. Lives beside the chat, while the
 * marked-up source text lives in the right-hand panel.
 */
export function AgentSummary({
  analysis,
  sourceKind = "pdf",
  onAskQuestion,
}: {
  analysis: AgentAnalysis;
  sourceKind?: "pdf" | "topic";
  onAskQuestion?: (question: string) => void;
}) {
  // Open by default on wide screens; on a phone it would fill the view before the chat.
  const wide = useMediaQuery("(min-width: 1024px)");
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? wide;
  const setOpen = (value: boolean) => setOverride(value);
  const redFlags = analysis.concerns.filter((finding) => finding.severity === "red_flag").length;
  const stats = [
    { label: redFlags === 1 ? "red flag" : "red flags", value: redFlags, icon: TriangleAlert, tone: "text-[#8f2f23]" },
    { label: "to review", value: analysis.concerns.length - redFlags, icon: ScrollText, tone: "text-[#8a4d1a]" },
    { label: analysis.deadlines.length === 1 ? "deadline" : "deadlines", value: analysis.deadlines.length, icon: CalendarPlus, tone: "text-[#6f5a12]" },
    { label: "money terms", value: analysis.financialDetails.length, icon: DollarSign, tone: "text-[#27527a]" },
    { label: "in your favor", value: analysis.favorableTerms.length, icon: CircleCheck, tone: "text-[#2a6238]" },
  ];

  return (
    <section className="border-b border-[#dce5d9] bg-[#f7faf4] px-5 py-4 sm:px-8" aria-label="Document summary">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-xs font-bold uppercase text-[#4c765a]">
            {sourceKind === "topic" ? "Session scope" : "Summary"}
          </span>
          <span className="block font-display text-lg font-semibold text-[#173c28]">
            {sourceKind === "topic" ? "What this agent covers" : "What this document means for you"}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[#4c765a] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-sm leading-6 text-[#4c6155]">{analysis.summary}</p>

          {sourceKind === "pdf" && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {stats.filter((stat) => stat.value > 0).map(({ label, value, icon: Icon, tone }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#d4dfd1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#3c5a47]"
                >
                  <Icon size={14} className={tone} />
                  <span className={tone}>{value}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}

          {analysis.suggestedQuestions.length > 0 && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#4c765a]">
                <HelpCircle size={14} />
                Ask about it
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {analysis.suggestedQuestions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => onAskQuestion?.(question.title)}
                    className="rounded-md border border-[#cddac9] bg-white px-3 py-2 text-left text-sm font-semibold text-[#2d5640] hover:border-[#8fb497] hover:bg-[#eef6ec]"
                  >
                    {question.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
