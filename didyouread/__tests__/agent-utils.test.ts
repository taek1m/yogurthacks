import { describe, expect, it } from "vitest";
import { agentIconMap } from "@/components/agent-garden/agentIconMap";
import { classifyDocument, getStablePosition } from "@/lib/agent-utils";

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
