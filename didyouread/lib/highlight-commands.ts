import { findQuoteInPages, highlightKey, normalizeQuote } from "@/lib/document-highlights";
import type {
  FindingSeverity,
  HighlightKind,
  HighlightOverride,
  ReaderHighlight,
  StoredDocumentAgent,
} from "@/types/agent";

/** The colours as the panel names them, which is how the reader asks for them. */
export const HIGHLIGHT_CATEGORIES = ["red_flag", "concern", "deadline", "financial", "favorable"] as const;
export type HighlightCategory = (typeof HIGHLIGHT_CATEGORIES)[number];

const CATEGORY_MEANS: Record<HighlightCategory, { kind: HighlightKind; severity: FindingSeverity }> = {
  red_flag: { kind: "concern", severity: "red_flag" },
  concern: { kind: "concern", severity: "important" },
  deadline: { kind: "deadline", severity: "important" },
  financial: { kind: "financial", severity: "important" },
  favorable: { kind: "favorable", severity: "info" },
};

export interface HighlightCommand {
  action: "add" | "change" | "remove";
  /** The sentence to act on, as the agent read it back out of the document. */
  quote: string;
  category?: HighlightCategory;
  title?: string;
}

export interface HighlightCommandResult {
  highlightOverrides: Record<string, HighlightOverride>;
  readerHighlights: ReaderHighlight[];
  /** How many commands took effect, and the quotes that could not be placed. */
  applied: number;
  missing: string[];
}

/** Every highlight already on the document, machine-made or asked for before. */
function existingHighlights(agent: StoredDocumentAgent): Array<{ key: string; quote: string }> {
  const { concerns, deadlines, financialDetails, favorableTerms } = agent.analysis;
  return [
    ...[...concerns, ...deadlines, ...financialDetails, ...favorableTerms].map((finding) => ({
      key: highlightKey(finding.quote),
      quote: finding.quote,
    })),
    ...(agent.readerHighlights ?? []).map((highlight) => ({ key: highlight.key, quote: highlight.quote })),
  ];
}

/**
 * Finds the highlight a command is talking about. An exact key match is the
 * happy path, but an agent asked to rename "the APR highlight" often quotes a
 * longer or shorter run of words than the highlight holds. Treating that as a
 * new highlight would quietly bury the old one underneath it, so a quote that
 * contains, or sits inside, an existing one counts as the same highlight.
 */
function matchExisting(
  existing: Array<{ key: string; quote: string }>,
  key: string,
  quote: string,
): string | null {
  if (existing.some((entry) => entry.key === key)) return key;
  const needle = normalizeQuote(quote);
  for (const entry of existing) {
    const held = normalizeQuote(entry.quote);
    const shorter = needle.length < held.length ? needle : held;
    if (shorter.length < 20) continue;
    if (needle.includes(held) || held.includes(needle)) return entry.key;
  }
  return null;
}

/**
 * Carries out highlight changes the reader asked for in the chat: adding a
 * colour to a passage the analysis missed, recolouring or renaming one it made,
 * or taking one away.
 *
 * Every quote is looked up in the extracted text first. A sentence that is not
 * in the document is reported back rather than saved, so the agent can never
 * invent a highlight over text nobody wrote.
 */
export function applyHighlightCommands(
  agent: StoredDocumentAgent,
  commands: HighlightCommand[],
): HighlightCommandResult {
  const overrides: Record<string, HighlightOverride> = { ...(agent.highlightOverrides ?? {}) };
  const readerHighlights = [...(agent.readerHighlights ?? [])];
  const existing = existingHighlights(agent);
  const createdAt = new Date().toISOString();
  const missing: string[] = [];
  let applied = 0;

  for (const command of commands) {
    const found = findQuoteInPages(agent.extractedPages, command.quote);
    if (!found) {
      missing.push(command.quote.slice(0, 120));
      continue;
    }
    const matched = matchExisting(existing, highlightKey(found.text), found.text);
    const key = matched ?? highlightKey(found.text);
    const asReader = readerHighlights.findIndex((highlight) => highlight.key === key);

    if (command.action === "remove") {
      // Hiding it rather than deleting keeps the change undoable from History,
      // the same way the panel's own Remove button behaves.
      if (!matched) {
        missing.push(command.quote.slice(0, 120));
        continue;
      }
      overrides[key] = { ...overrides[key], removed: true, at: createdAt };
      applied += 1;
      continue;
    }

    const means = command.category ? CATEGORY_MEANS[command.category] : undefined;
    const title = command.title?.trim().slice(0, 120);

    if (matched) {
      const previous = overrides[key] ?? {};
      const next: HighlightOverride = { ...previous };
      // Acting on a highlight at all means the reader wants to see it.
      delete next.removed;
      if (means) {
        next.kind = means.kind;
        next.severity = means.severity;
      }
      if (title) next.title = title;
      next.at = createdAt;
      overrides[key] = next;
      // A reader highlight keeps its own title so the panel reads the same
      // whether or not the override is later undone.
      if (asReader !== -1 && title) readerHighlights[asReader] = { ...readerHighlights[asReader], title };
      applied += 1;
      continue;
    }

    const category = means ?? CATEGORY_MEANS.concern;
    existing.push({ key, quote: found.text });
    readerHighlights.push({
      key,
      quote: found.text,
      kind: category.kind,
      severity: category.severity,
      title: title || "Highlighted from the chat",
      detail: "You asked for this highlight in the chat.",
      createdAt,
    });
    delete overrides[key];
    applied += 1;
  }

  return { highlightOverrides: overrides, readerHighlights, applied, missing };
}

/** One line the agent adds to its reply when a quote was not in the document. */
export function missingQuoteNote(missing: string[]): string {
  if (missing.length === 0) return "";
  const list = missing.map((quote) => `“${quote}”`).join(", ");
  return missing.length === 1
    ? `\n\nI could not find ${list} in the document, so I left the highlights alone. Quote the sentence as it is written and I will mark it.`
    : `\n\nI could not find these in the document, so I left them alone: ${list}.`;
}
