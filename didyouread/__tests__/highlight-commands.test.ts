import { describe, expect, it } from "vitest";
import { analyzePages } from "@/lib/agent-utils";
import { buildHighlightedDocument, highlightKey } from "@/lib/document-highlights";
import { applyHighlightCommands, missingQuoteNote } from "@/lib/highlight-commands";
import type { StoredDocumentAgent } from "@/types/agent";

const pages = [
  {
    page: 1,
    text: [
      "The security deposit of $1,450 is non-refundable if the Tenant terminates early.",
      "Utilities are included at no additional charge for the first three months.",
      "Parking spot 14 is assigned to this unit for the length of the term.",
    ].join("\n"),
  },
];

function agentWith(extra: Partial<StoredDocumentAgent> = {}): StoredDocumentAgent {
  return {
    id: "agent-1", ownerId: "owner-1", name: "Lease agent", documentName: "lease.pdf",
    documentType: "apartment_lease", status: "ready", statusLabel: "Analysis complete",
    deadlineCount: 0, attentionCount: 0, analysis: analyzePages(pages), messages: [],
    extractedPages: pages, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

const PARKING = "Parking spot 14 is assigned to this unit for the length of the term.";
const DEPOSIT = "The security deposit of $1,450 is non-refundable if the Tenant terminates early.";

describe("highlighting from the chat", () => {
  it("marks a passage the analysis never picked, in the colour asked for", () => {
    const result = applyHighlightCommands(agentWith(), [
      { action: "add", quote: PARKING, category: "favorable", title: "Parking spot" },
    ]);

    expect(result.applied).toBe(1);
    expect(result.readerHighlights).toEqual([
      expect.objectContaining({ kind: "favorable", severity: "info", title: "Parking spot", quote: PARKING }),
    ]);

    // It reaches the panel as a highlight like any other.
    const painted = buildHighlightedDocument(pages, analyzePages(pages), result.readerHighlights);
    const mark = painted.marks.find((entry) => entry.title === "Parking spot");
    expect(mark).toMatchObject({ fromReader: true, kind: "favorable" });
    const onPage = painted.pages[0].segments.some((segment) => segment.mark?.title === "Parking spot");
    expect(onPage).toBe(true);
  });

  it("finds the sentence even when the quote is not copied exactly", () => {
    const result = applyHighlightCommands(agentWith(), [
      { action: "add", quote: "parking spot 14 is assigned to this unit", category: "concern" },
    ]);

    // The stored quote is the document's own wording, so the key is stable.
    expect(result.readerHighlights[0].quote).toBe(PARKING);
    expect(result.readerHighlights[0].key).toBe(highlightKey(PARKING));
  });

  it("recolours and renames a highlight the analysis made", () => {
    const result = applyHighlightCommands(agentWith(), [
      { action: "change", quote: DEPOSIT, category: "financial", title: "Deposit is not coming back" },
    ]);

    expect(result.readerHighlights).toEqual([]);
    expect(result.highlightOverrides[highlightKey(DEPOSIT)]).toEqual({
      kind: "financial",
      severity: "important",
      title: "Deposit is not coming back",
      at: expect.any(String),
    });
  });

  it("removes a highlight without losing the way back", () => {
    const result = applyHighlightCommands(agentWith(), [{ action: "remove", quote: DEPOSIT }]);
    expect(result.highlightOverrides[highlightKey(DEPOSIT)]).toEqual({ removed: true, at: expect.any(String) });
  });

  it("brings a removed highlight back when it is asked for again", () => {
    const key = highlightKey(DEPOSIT);
    const result = applyHighlightCommands(
      agentWith({ highlightOverrides: { [key]: { removed: true } } }),
      [{ action: "change", quote: DEPOSIT, category: "red_flag" }],
    );

    // The old removed flag is gone, not merely overwritten.
    expect(result.highlightOverrides[key]).toEqual({
      kind: "concern",
      severity: "red_flag",
      at: expect.any(String),
    });
  });

  it("refuses to highlight a sentence that is not in the document", () => {
    const result = applyHighlightCommands(agentWith(), [
      { action: "add", quote: "The landlord will pay for a hotel during any repair.", category: "favorable" },
    ]);

    expect(result.applied).toBe(0);
    expect(result.readerHighlights).toEqual([]);
    expect(result.missing).toHaveLength(1);
    expect(missingQuoteNote(result.missing)).toMatch(/could not find/i);
  });

  it("says nothing when every change landed", () => {
    expect(missingQuoteNote([])).toBe("");
  });

  it("renames the highlight that is already there when the quote runs long", () => {
    // The agent quoted the whole line; the analysis holds only one sentence of it.
    const result = applyHighlightCommands(agentWith(), [
      {
        action: "change",
        quote: `${DEPOSIT} Utilities are included at no additional charge for the first three months.`,
        title: "Deposit trap",
      },
    ]);

    expect(result.readerHighlights).toEqual([]);
    expect(result.highlightOverrides[highlightKey(DEPOSIT)]).toEqual({
      title: "Deposit trap",
      at: expect.any(String),
    });
  });

  it("does not stack a second highlight on one it just added", () => {
    const first = applyHighlightCommands(agentWith(), [
      { action: "add", quote: PARKING, category: "favorable", title: "Parking spot" },
    ]);
    const second = applyHighlightCommands(
      agentWith({ readerHighlights: first.readerHighlights }),
      [{ action: "change", quote: PARKING, category: "deadline", title: "Parking, by the way" }],
    );

    expect(second.readerHighlights).toHaveLength(1);
    expect(second.highlightOverrides[first.readerHighlights[0].key]).toMatchObject({ kind: "deadline" });
  });
});
