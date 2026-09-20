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

/** Opening a chat also records the visit, so every render makes a request. */
function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentQuestions(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/messages"));
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

  it("shows the question immediately and marks the agent as replying", async () => {
    let release: (value: unknown) => void = () => {};
    const reply = new Promise((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      await reply;
      return {
        ok: true,
        json: async () => ({
          messages: [
            { id: "m1", role: "user", content: "When is rent due?", createdAt: "2026-01-02T00:00:00.000Z" },
            { id: "m2", role: "assistant", content: "On the first day.", createdAt: "2026-01-02T00:00:01.000Z" },
          ],
        }),
      };
    }));
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "When is rent due?" } });
    fireEvent.keyDown(composer(), { key: "Enter" });

    // The question is on screen before the reply exists.
    await waitFor(() => expect(screen.getByText("When is rent due?")).toBeInTheDocument());
    expect(screen.getByText(/is writing a reply/)).toBeInTheDocument();
    expect(screen.queryByText("On the first day.")).not.toBeInTheDocument();

    release(null);
    await waitFor(() => expect(screen.getByText("On the first day.")).toBeInTheDocument());
    expect(screen.queryByText(/is writing a reply/)).not.toBeInTheDocument();
    // The optimistic copy was swapped for the saved one, not duplicated.
    expect(screen.getAllByText("When is rent due?")).toHaveLength(1);
  });

  it("puts the question back in the box when sending fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Gemini is overloaded" }),
    }));
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "When is rent due?" } });
    fireEvent.keyDown(composer(), { key: "Enter" });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Gemini is overloaded"));
    // The bubble is withdrawn (the textarea still holds the text, so scope the check).
    expect(document.querySelectorAll('article[id^="message-"]')).toHaveLength(0);
    expect(composer()).toHaveValue("When is rent due?");
  });

  it("keeps Shift+Enter as a newline instead of sending", () => {
    const fetchMock = stubFetch();
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "first line" } });
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });

    expect(sentQuestions(fetchMock)).toHaveLength(0);
    expect(composer()).toHaveValue("first line");
  });

  it("does not send while an IME is still composing the text", () => {
    const fetchMock = stubFetch();
    render(<AgentChat agent={agent} />);

    fireEvent.change(composer(), { target: { value: "한글" } });
    fireEvent.keyDown(composer(), { key: "Enter", isComposing: true });

    expect(sentQuestions(fetchMock)).toHaveLength(0);
  });
});
