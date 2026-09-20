import { describe, expect, it } from "vitest";
import { agentIconMap } from "@/components/agent-garden/agentIconMap";
import { analyzePages, classifyDocument, getStablePosition } from "@/lib/agent-utils";

describe("agent document visuals", () => {
  it.each([
    ["policy.pdf", "automobile coverage and VIN", "auto_insurance"],
    ["coverage.pdf", "renters insurance personal property", "renters_insurance"],
    ["home.pdf", "apartment lease and security deposit", "apartment_lease"],
    ["bill.pdf", "university tuition payment", "school_payment"],
    ["statement.pdf", "checking account from the bank", "bank"],
    ["notes.pdf", "miscellaneous terms", "general"],
    ["Car agreement", "vehicle purchase questions", "auto_insurance"],
  ] as const)("classifies %s", (name, text, expected) => {
    expect(classifyDocument(name, text)).toBe(expected);
    expect(agentIconMap[expected].icon).toBeDefined();
  });

  it("assigns stable positions", () => {
    expect(getStablePosition(3)).toEqual(getStablePosition(3));
    expect(getStablePosition(3)).not.toEqual(getStablePosition(4));
  });
});

describe("a second document added to an agent", () => {
  const dense = Array.from({ length: 14 }, (_, index) =>
    `Payment ${index + 1} of $${100 + index}.00 is due on 2026-0${(index % 9) + 1}-15 and a late fee applies.`,
  ).join("\n");
  const added = [
    "Buyer waives the right to a jury trial and agrees to binding arbitration.",
    "First payment is due on 2027-03-01.",
    "A late fee of $95.00 applies after five days.",
  ].join("\n");

  it("marks the new document even when the first one is full of findings", () => {
    const analysis = analyzePages([
      { page: 1, text: dense, source: "lease.pdf" },
      { page: 2, text: added, source: "car.jpg" },
    ]);
    const onNewDocument = [
      ...analysis.concerns,
      ...analysis.deadlines,
      ...analysis.financialDetails,
    ].filter((finding) => finding.page === 2);

    // The dense first document used to spend every slot before page 2 was read.
    expect(analysis.deadlines.some((finding) => finding.quote.includes("2027-03-01"))).toBe(true);
    expect(analysis.concerns.some((finding) => finding.quote.includes("jury trial"))).toBe(true);
    expect(analysis.financialDetails.some((finding) => finding.quote.includes("$95.00"))).toBe(true);
    expect(onNewDocument.length).toBeGreaterThanOrEqual(3);
  });

  it("still caps a single document, so one file cannot flood the panel", () => {
    const analysis = analyzePages([{ page: 1, text: dense, source: "lease.pdf" }]);
    expect(analysis.deadlines.length).toBeLessThanOrEqual(10);
  });
});
