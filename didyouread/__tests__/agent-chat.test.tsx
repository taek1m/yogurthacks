import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentChat } from "@/components/agents/AgentChat";
import type { DocumentAgent } from "@/types/agent";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const agent: DocumentAgent = {
  id: "agent-1",
  ownerId: "owner-1",
  name: "Lease agent",
  documentName: "lease.pdf",
  documentNames: ["lease.pdf"],
  sourceKind: "pdf",
  documentType: "apartment_lease",
  status: "ready",
  statusLabel: "Analysis complete",
  deadlineCount: 0,
  attentionCount: 0,
  analysis: { summary: "Summary", favorableTerms: [], concerns: [], deadlines: [], financialDetails: [], suggestedQuestions: [] },
  messages: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function composer() {
  return screen.getByLabelText("Ask this agent a question");
}

describe("chat composer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends on Enter and shows the exchange in the chat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          { id: "m1", role: "user", content: "When is rent due?", createdAt: "2026-01-02T00:00:00.000Z" },
          { id: "m2", role: "assistant", content: "On the first day of each month.", createdAt: "2026-01-02T00:00:01.000Z" },
        ],
      }),
    }));
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "When is rent due?" } });
    fireEvent.keyDown(composer(), { key: "Enter" });

    await waitFor(() => expect(screen.getByText("When is rent due?")).toBeInTheDocument());
    expect(screen.getByText("On the first day of each month.")).toBeInTheDocument();
    expect(composer()).toHaveValue("");
  });

  it("keeps Shift+Enter as a newline instead of sending", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "first line" } });
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(composer()).toHaveValue("first line");
  });

  it("does not send while an IME is still composing the text", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "한글" } });
    fireEvent.keyDown(composer(), { key: "Enter", isComposing: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
