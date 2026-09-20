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

const twoPages = [
  pages[0],
  { page: 2, text: "A late fee of $95 applies after the fifth day of the month." },
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

function paintTwoPages(removedPages: number[] = []) {
  const document2 = buildHighlightedDocument(twoPages, analyzePages(twoPages));
  return render(
    <DocumentHighlights
      agentId="agent-1"
      document={document2}
      documentName="lease.pdf"
      removedPages={removedPages}
    />,
  );
}

function pageText() {
  return [...document.querySelectorAll("article")].map((node) => node.textContent ?? "");
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

describe("the change history", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists each change and undoes just the one picked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    paint();

    clickDepositMark();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Money" }));
    fireEvent.click(screen.getByRole("button", { name: /^History/ }));

    expect(await screen.findByText(/^1 change\./)).toBeInTheDocument();
    expect(screen.getByText(/Red flags → Money/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Undo:/ }));
    await waitFor(() => expect(screen.getByText(/have not changed anything yet/)).toBeInTheDocument());
  });

  it("restores everything in one go", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    paint({ [depositKey]: { removed: true } });

    fireEvent.click(screen.getByRole("button", { name: /^History/ }));
    fireEvent.click(screen.getByRole("button", { name: /Restore the original highlights/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-1/highlights", expect.objectContaining({ method: "DELETE" })),
    );
    expect(marked().some((text) => /non-refundable if/.test(text))).toBe(true);
  });

  it("puts the edits back when restoring fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    paint({ [depositKey]: { removed: true } });

    fireEvent.click(screen.getByRole("button", { name: /^History/ }));
    fireEvent.click(screen.getByRole("button", { name: /Restore the original highlights/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("were not restored"));
    expect(marked().some((text) => /non-refundable if/.test(text))).toBe(false);
  });
});

describe("deleting a page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("takes the page out of the view, saves it, and lists it in the history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hiddenPages: [2] }) });
    vi.stubGlobal("fetch", fetchMock);
    paintTwoPages();

    expect(pageText().some((text) => /late fee/.test(text))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete page 2" }));

    await waitFor(() => expect(pageText().some((text) => /late fee/.test(text))).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1/highlights",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ page: 2, hidden: true }) }),
    );

    fireEvent.click(screen.getByRole("button", { name: /^History/ }));
    expect(await screen.findByText("Page 2 deleted")).toBeInTheDocument();
  });

  it("puts the page back when its history entry is undone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hiddenPages: [] }) }));
    paintTwoPages([2]);

    expect(pageText().some((text) => /late fee/.test(text))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /^History/ }));
    fireEvent.click(screen.getByRole("button", { name: "Undo: page 2 deleted" }));

    await waitFor(() => expect(pageText().some((text) => /late fee/.test(text))).toBe(true));
  });

  it("keeps the page when saving the deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    paintTwoPages();

    fireEvent.click(screen.getByRole("button", { name: "Delete page 2" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/was not deleted/i));
    expect(pageText().some((text) => /late fee/.test(text))).toBe(true);
  });
});
