import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderPanels } from "@/components/navigation/HeaderPanels";
import type { DocumentAgent } from "@/types/agent";

const agent: DocumentAgent = {
  id: "lease-agent",
  ownerId: "owner",
  name: "Lease agent",
  documentName: "lease.pdf",
  documentType: "apartment_lease",
  status: "ready",
  statusLabel: "Needs attention",
  deadlineCount: 2,
  attentionCount: 1,
  analysis: { summary: "", favorableTerms: [], concerns: [], deadlines: [], financialDetails: [], suggestedQuestions: [] },
  messages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("HeaderPanels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("builds notifications and to-do items from agent status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agents: [agent] }),
    }));
    render(<HeaderPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("1 item needs attention")).toBeInTheDocument();
    expect(screen.getByText("2 deadlines to review")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "What to do list" }));
    expect(await screen.findByText("Review Lease agent")).toBeInTheDocument();
    expect(screen.getByText("Confirm dates in Lease agent")).toBeInTheDocument();
  });
});
