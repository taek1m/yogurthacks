import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchResults } from "@/components/navigation/SearchResults";

const results = {
  agents: [{ agentId: "a1", agentName: "Lease agent", documentName: "lease.pdf", documentType: "apartment_lease" as const }],
  messages: [{ agentId: "a1", agentName: "Lease agent", messageId: "m1", excerpt: "The rent is due...", createdAt: "2026-01-01T00:00:00.000Z" }],
};

describe("SearchResults", () => {
  it("groups agents and messages under their own headings", () => {
    render(<SearchResults state="ready" results={results} onPickAgent={() => {}} />);
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Messages" })).toBeInTheDocument();
  });

  it("shows a picked agent in the garden instead of opening its chat", () => {
    const onPickAgent = vi.fn();
    render(<SearchResults state="ready" results={results} onPickAgent={onPickAgent} />);

    fireEvent.click(screen.getByRole("button", { name: /lease\.pdf/i }));
    expect(onPickAgent).toHaveBeenCalledWith("a1");
  });

  it("still links a matched message straight to that point in the chat", () => {
    render(<SearchResults state="ready" results={results} onPickAgent={() => {}} />);
    expect(screen.getByRole("link", { name: /rent is due/i })).toHaveAttribute("href", "/agents/a1?message=m1");
  });
});
