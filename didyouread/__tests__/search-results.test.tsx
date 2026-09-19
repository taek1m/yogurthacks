import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchResults } from "@/components/navigation/SearchResults";

describe("SearchResults", () => {
  it("groups agents and messages with persistent navigation links", () => {
    render(<SearchResults state="ready" results={{
      agents: [{ agentId: "a1", agentName: "Lease agent", documentName: "lease.pdf", documentType: "apartment_lease" }],
      messages: [{ agentId: "a1", agentName: "Lease agent", messageId: "m1", excerpt: "The rent is due...", createdAt: "2026-01-01T00:00:00.000Z" }],
    }} />);
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Messages" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lease.pdf/i })).toHaveAttribute("href", "/agents/a1");
    expect(screen.getByRole("link", { name: /rent is due/i })).toHaveAttribute("href", "/agents/a1?message=m1");
  });
});
