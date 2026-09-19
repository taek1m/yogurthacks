import { describe, expect, it } from "vitest";
import { analyzePages } from "@/lib/agent-utils";
import { buildHighlightedDocument } from "@/lib/document-highlights";
import type { AgentAnalysis } from "@/types/agent";

const pages = [
  {
    page: 1,
    text: `RESIDENTIAL LEASE AGREEMENT
This Lease is effective January 1, 2026 and continues until you cancel in writing.
Tenant shall pay rent of $1,450 per month, due on the first day of each month.
A late fee of $75 applies to any payment received after the fifth day.
The security deposit of $1,450 is non-refundable if the Tenant terminates early.
Landlord may modify the parking rules at its sole discretion without prior notice.
Utilities are included at no additional charge for the first three months.
Tenant agrees to waive any right to a jury trial in a dispute with the Landlord.`,
  },
];

const emptyAnalysis: AgentAnalysis = {
  summary: "",
  favorableTerms: [],
  concerns: [],
  deadlines: [],
  financialDetails: [],
  suggestedQuestions: [],
};

describe("buildHighlightedDocument", () => {
  it("marks every category it finds and traces each one back to the source text", () => {
    const highlighted = buildHighlightedDocument(pages, analyzePages(pages));

    expect(highlighted.unmatched).toBe(0);
    expect(highlighted.counts.concern).toBeGreaterThan(0);
    expect(highlighted.counts.deadline).toBeGreaterThan(0);
    expect(highlighted.counts.financial).toBeGreaterThan(0);
    expect(highlighted.counts.favorable).toBeGreaterThan(0);
    expect(highlighted.marks.some((mark) => mark.severity === "red_flag")).toBe(true);

    const marked = highlighted.pages[0].segments.filter((segment) => segment.mark);
    expect(marked.some((segment) => segment.text.includes("non-refundable"))).toBe(true);
    expect(marked.some((segment) => segment.text.includes("waive any right"))).toBe(true);
  });

  it("rebuilds the page text exactly, so nothing is dropped or duplicated", () => {
    const highlighted = buildHighlightedDocument(pages, analyzePages(pages));
    const rebuilt = highlighted.pages[0].segments.map((segment) => segment.text).join("");
    expect(rebuilt).toBe(pages[0].text);
  });

  it("returns the untouched page when there is nothing to mark", () => {
    const highlighted = buildHighlightedDocument(pages, emptyAnalysis);
    expect(highlighted.marks).toHaveLength(0);
    expect(highlighted.pages[0].segments).toEqual([{ text: pages[0].text, mark: null }]);
  });

  it("counts a finding whose quote is absent from the text as unmatched", () => {
    const highlighted = buildHighlightedDocument(pages, {
      ...emptyAnalysis,
      concerns: [
        {
          id: "concern-1",
          title: "Missing clause",
          detail: "Not present in this document.",
          quote: "The tenant surrenders all rights to the moon.",
          page: 1,
          severity: "red_flag",
        },
      ],
    });
    expect(highlighted.unmatched).toBe(1);
    expect(highlighted.pages[0].segments.every((segment) => segment.mark === null)).toBe(true);
  });
});
