import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("AgentGarden", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the true empty state", () => {
    render(<AgentGarden agents={[]} />);
    expect(screen.getByText("Your document agents live here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a new agent" })).toBeInTheDocument();
  });

  it("renders backend agents as links", () => {
    render(<AgentGarden agents={[agent]} />);
    const link = screen.getByRole("link", { name: /Open Auto insurance agent/ });
    expect(link).toHaveAttribute("href", "/agents/agent-1");
    expect(screen.queryByText("Your document agents live here")).not.toBeInTheDocument();
  });

  it("renames an agent from its management menu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agent: { ...agent, name: "My car contract" } }),
    }));
    render(<AgentGarden agents={[agent]} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage Auto insurance agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "My car contract" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText("My car contract")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/agents/agent-1", expect.objectContaining({ method: "PATCH" }));
  });
});
