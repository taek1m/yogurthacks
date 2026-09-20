import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentHighlights } from "@/components/agents/DocumentHighlights";
import { buildHighlightedDocument, highlightKey } from "@/lib/document-highlights";
import { analyzePages } from "@/lib/agent-utils";

const pages = [
  {
    page: 1,
    text: [
      "The security deposit of $1,450 is non-refundable if the Tenant terminates early.",
      "Utilities are included at no additional charge for the first three months.",
    ].join("\n"),
  },
];

const analysis = analyzePages(pages);
const doc = buildHighlightedDocument(pages, analysis);
const depositKey = highlightKey("The security deposit of $1,450 is non-refundable if the Tenant terminates early.");

function paint(overrides = {}) {
  return render(
    <DocumentHighlights
      agentId="agent-1"
      document={doc}
      documentName="lease.pdf"
      overrides={overrides}
    />,
  );
}

function marked() {
  return [...document.querySelectorAll("mark")].map((node) => node.textContent ?? "");
}

/** Marks are labelled by category, so find the deposit one by what it quotes. */
function clickDepositMark() {
  const node = [...document.querySelectorAll("mark")].find((mark) => /non-refundable/.test(mark.textContent ?? ""));
  if (!node) throw new Error("the deposit highlight is not on screen");
  fireEvent.click(node);
}

describe("editing the highlights", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops a highlight the reader removes and offers to put it back", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    paint();

    expect(marked().some((text) => /non-refundable/.test(text))).toBe(true);
    clickDepositMark();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(marked().some((text) => /non-refundable/.test(text))).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/highlights",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.getByText(/Removed by you/)).toBeInTheDocument();
  });

  it("recolours a highlight into the category the reader picks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    paint();

    clickDepositMark();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Money" }));

    await waitFor(() => {
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toMatchObject({ key: depositKey, kind: "financial" });
    });
  });

  it("starts from the edits already saved for this agent", () => {
    vi.stubGlobal("fetch", vi.fn());
    paint({ [depositKey]: { removed: true } });

    expect(marked().some((text) => /non-refundable/.test(text))).toBe(false);
    expect(screen.getByText(/Removed by you/)).toBeInTheDocument();
  });

  it("puts the highlight back and forgets the edit when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    paint();

    clickDepositMark();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("was not saved"));
    expect(marked().some((text) => /non-refundable/.test(text))).toBe(true);
  });
});
