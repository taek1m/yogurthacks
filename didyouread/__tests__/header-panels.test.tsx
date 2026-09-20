import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderPanels } from "@/components/navigation/HeaderPanels";
import type { TodoItem } from "@/types/agent";

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);

const todos: TodoItem[] = [
  { id: "t-late", ownerId: "owner", title: "Pay the August rent", dueDate: later, done: false, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t-soon", ownerId: "owner", title: "Pay the next bill", detail: "$1,450 to the landlord", dueDate: today, agentId: "a1", agentName: "Lease agent", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t-none", ownerId: "owner", title: "Ask about the parking rules", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
];

function stubFetch(list: TodoItem[]) {
  const mock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => ({ todos: list }) };
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("HeaderPanels", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("lists the open tasks with the soonest due date first", async () => {
    stubFetch(todos);
    render(<HeaderPanels />);

    fireEvent.click(await screen.findByRole("button", { name: "What to do list" }));
    const titles = await waitFor(() => {
      const found = screen.getAllByText(/Pay the|Ask about/);
      expect(found).toHaveLength(3);
      return found.map((node) => node.textContent);
    });
    // Due today, then in nine days, then the undated one.
    expect(titles).toEqual(["Pay the next bill", "Pay the August rent", "Ask about the parking rules"]);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("fades a ticked task away and offers an undo", async () => {
    const fetchMock = stubFetch(todos);
    render(<HeaderPanels />);
    fireEvent.click(await screen.findByRole("button", { name: "What to do list" }));

    fireEvent.click(await screen.findByRole("button", { name: "Complete: Pay the next bill" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/todos/t-soon", expect.objectContaining({ method: "PATCH" })),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    // It leaves the list once the fade has played (the undo note still names it).
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole("button", { name: "Complete: Pay the next bill" })).not.toBeInTheDocument();
  });

  it("drops the undo offer after a while", async () => {
    stubFetch(todos);
    render(<HeaderPanels />);
    fireEvent.click(await screen.findByRole("button", { name: "What to do list" }));
    fireEvent.click(await screen.findByRole("button", { name: "Complete: Pay the next bill" }));

    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("no longer offers notifications", async () => {
    stubFetch([]);
    render(<HeaderPanels />);
    await waitFor(() => expect(screen.getByRole("button", { name: "What to do list" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
