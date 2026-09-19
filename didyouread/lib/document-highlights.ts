import type {
  AgentAnalysis,
  DocumentPage,
  Finding,
  FindingSeverity,
  HighlightKind,
} from "@/types/agent";

export interface HighlightMark {
  findingId: string;
  kind: HighlightKind;
  severity: FindingSeverity;
  title: string;
  detail: string;
  date?: string;
}

export interface PageSegment {
  text: string;
  mark: HighlightMark | null;
}

export interface HighlightedPage {
  page: number;
  segments: PageSegment[];
}

export interface HighlightedDocument {
  pages: HighlightedPage[];
  /** Findings in reading order, so the panel and the page agree on numbering. */
  marks: HighlightMark[];
  counts: Record<HighlightKind, number>;
  /** Findings whose quote could not be located in the extracted text. */
  unmatched: number;
}

/**
 * Highest priority first. A sentence claimed by a concern is not re-marked as a
 * money term, so overlapping matches never produce nested <mark> elements.
 */
const KIND_ORDER: HighlightKind[] = ["concern", "deadline", "financial", "favorable"];

function findingsByKind(analysis: AgentAnalysis): Record<HighlightKind, Finding[]> {
  return {
    concern: analysis.concerns,
    deadline: analysis.deadlines,
    financial: analysis.financialDetails,
    favorable: analysis.favorableTerms,
  };
}

/**
 * Collapses runs of whitespace and lower-cases the text, keeping a map from each
 * normalized character back to its index in the original string. Quotes are stored
 * whitespace-collapsed, so they only match the raw page text after the same pass.
 */
function normalize(text: string): { value: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      chars.push(" ");
      map.push(index);
      lastWasSpace = true;
      continue;
    }
    chars.push(char.toLowerCase());
    map.push(index);
    lastWasSpace = false;
  }
  return { value: chars.join(""), map };
}

function normalizeQuote(quote: string): string {
  return quote.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Locates a quote inside a page, falling back to a prefix when the tail was truncated. */
function locate(
  normalized: { value: string; map: number[] },
  quote: string,
): { start: number; end: number } | null {
  const needle = normalizeQuote(quote);
  if (needle.length < 8) return null;
  for (const candidate of [needle, needle.slice(0, 80), needle.slice(0, 40)]) {
    if (candidate.length < 8) continue;
    const at = normalized.value.indexOf(candidate);
    if (at === -1) continue;
    return {
      start: normalized.map[at],
      end: normalized.map[at + candidate.length - 1] + 1,
    };
  }
  return null;
}

export function buildHighlightedDocument(
  pages: DocumentPage[],
  analysis: AgentAnalysis,
): HighlightedDocument {
  const normalizedPages = new Map(pages.map((page) => [page.page, normalize(page.text)]));
  const spans = new Map<number, Array<{ start: number; end: number; mark: HighlightMark }>>();
  const marks: HighlightMark[] = [];
  const counts: Record<HighlightKind, number> = { concern: 0, deadline: 0, financial: 0, favorable: 0 };
  let unmatched = 0;

  const byKind = findingsByKind(analysis);
  for (const kind of KIND_ORDER) {
    for (const finding of byKind[kind]) {
      const mark: HighlightMark = {
        findingId: finding.id,
        kind,
        severity: finding.severity ?? "important",
        title: finding.title,
        detail: finding.detail,
        date: finding.date,
      };
      counts[kind] += 1;

      // A finding records the page it came from; fall back to scanning every page.
      const searchOrder = finding.page
        ? [finding.page, ...pages.map((page) => page.page).filter((page) => page !== finding.page)]
        : pages.map((page) => page.page);
      let placed = false;
      for (const pageNumber of searchOrder) {
        const normalized = normalizedPages.get(pageNumber);
        if (!normalized) continue;
        const range = locate(normalized, finding.quote);
        if (!range) continue;
        const pageSpans = spans.get(pageNumber) ?? [];
        // Skip anything already claimed by a higher-priority finding.
        if (pageSpans.some((span) => range.start < span.end && span.start < range.end)) {
          placed = true;
          break;
        }
        pageSpans.push({ ...range, mark });
        spans.set(pageNumber, pageSpans);
        placed = true;
        break;
      }
      if (!placed) unmatched += 1;
      marks.push(mark);
    }
  }

  const highlightedPages = pages.map((page) => {
    const pageSpans = (spans.get(page.page) ?? []).sort((a, b) => a.start - b.start);
    const segments: PageSegment[] = [];
    let cursor = 0;
    for (const span of pageSpans) {
      if (span.start > cursor) segments.push({ text: page.text.slice(cursor, span.start), mark: null });
      segments.push({ text: page.text.slice(span.start, span.end), mark: span.mark });
      cursor = span.end;
    }
    if (cursor < page.text.length) segments.push({ text: page.text.slice(cursor), mark: null });
    return { page: page.page, segments };
  });

  return {
    pages: highlightedPages,
    marks,
    counts,
    unmatched,
  };
}
