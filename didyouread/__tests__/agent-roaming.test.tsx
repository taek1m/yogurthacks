import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentGarden } from "@/components/agent-garden/AgentGarden";
import type { DocumentAgent } from "@/types/agent";

const agent: DocumentAgent = {
  id: "agent-1",
  ownerId: "owner-1",
  name: "Auto insurance agent",
  documentName: "policy.pdf",
  documentType: "auto_insurance",
  status: "ready",
  statusLabel: "Analysis complete",
  deadlineCount: 0,
  attentionCount: 0,
  position: { xPercent: 20, yPercent: 50 },
  analysis: { summary: "Summary", favorableTerms: [], concerns: [], deadlines: [], financialDetails: [], suggestedQuestions: [] },
  messages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function agentLink() {
  return screen.getByRole("link", { name: /Open Auto insurance agent/ });
}

describe("agent stop, go, and deletion by cannon", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops the stroll on one click and restarts it on the next", async () => {
    render(<AgentGarden agents={[agent]} />);
    expect(agentLink()).toHaveAccessibleName(/Analysis complete$/);

    fireEvent.click(agentLink(), { detail: 1 });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(agentLink()).toHaveAccessibleName(/, paused$/);

    fireEvent.click(agentLink(), { detail: 1 });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(agentLink()).toHaveAccessibleName(/Analysis complete$/);
  });

  it("treats a second click as opening the conversation, not a toggle", async () => {
    render(<AgentGarden agents={[agent]} />);
    fireEvent.click(agentLink(), { detail: 1 });
    fireEvent.click(agentLink(), { detail: 2 });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(agentLink()).toHaveAccessibleName(/Analysis complete$/);
    expect(agentLink()).toHaveAttribute("href", "/agents/agent-1");
  });

  it("fires the agent out of the cannon when Remove is confirmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentGarden agents={[agent]} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage Auto insurance agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: /^Remove$/ }));

    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-1", expect.objectContaining({ method: "DELETE" })),
    );
  });
});

