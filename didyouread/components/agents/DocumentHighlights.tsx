"use client";

import { CalendarPlus, ChevronDown, ChevronRight, CircleAlert, CircleCheck, DollarSign, FileText, History, MessageSquareText, LoaderCircle, PanelRightClose, RefreshCw, RotateCcw, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { HighlightMark, HighlightedDocument } from "@/lib/document-highlights";
import { PALETTE } from "@/lib/highlight-palette";
import type { HighlightOverride } from "@/types/agent";

type Tone = "red_flag" | "concern" | "deadline" | "financial" | "favorable";

const TONES: Record<Tone, { label: string; icon: LucideIcon; mark: string; chip: string; dot: string }> = {
  red_flag: {
    label: "Red flags",
    icon: TriangleAlert,
    mark: "bg-[#ffd4cc] text-[#5d1c14] decoration-[#b03a2e]",
    chip: "border-[#e0a79d] bg-[#ffece8] text-[#8f2f23]",
    dot: "bg-[#b03a2e]",
  },
  concern: {
    label: "Review closely",
    icon: CircleAlert,
    mark: "bg-[#ffe3c2] text-[#5a3410] decoration-[#9a551e]",
    chip: "border-[#e2bd93] bg-[#fff3e4] text-[#8a4d1a]",
    dot: "bg-[#9a551e]",
  },
  deadline: {
    label: "Deadlines",
    icon: CalendarPlus,
    mark: "bg-[#fff0b0] text-[#4d3f06] decoration-[#8a6d1f]",
    chip: "border-[#ddcb84] bg-[#fffae0] text-[#6f5a12]",
    dot: "bg-[#8a6d1f]",
  },
  financial: {
    label: "Money",
    icon: DollarSign,
    mark: "bg-[#d5e7fa] text-[#123a4f] decoration-[#2f5d86]",
    chip: "border-[#a9c6e2] bg-[#eaf3fc] text-[#27527a]",
    dot: "bg-[#2f5d86]",
  },
  favorable: {
    label: "In your favor",
    icon: CircleCheck,
    mark: "bg-[#d5efd6] text-[#17401f] decoration-[#2f6b3c]",
    chip: "border-[#a9cfae] bg-[#eaf6ea] text-[#2a6238]",
    dot: "bg-[#2f6b3c]",
  },
};

const TONE_ORDER: Tone[] = ["red_flag", "concern", "deadline", "financial", "favorable"];

export function toneOf(mark: HighlightMark): Tone {
  if (mark.kind === "concern") return mark.severity === "red_flag" ? "red_flag" : "concern";
  return mark.kind;
}

/** How one highlight is painted and filed: a category, or a colour of your own. */
interface Paint {
  id: string;
  label: string;
  mark: string;
  chip: string;
  dot: string;
  icon: LucideIcon | null;
}

/**
 * A reader's own colour wins over the category the analysis chose, and carries
 * whatever they called it — "Chapter titles" is as good a grouping as "Money".
 */
function paintOf(mark: HighlightMark): Paint {
  if (mark.color && PALETTE[mark.color]) {
    const swatch = PALETTE[mark.color];
    return {
      id: mark.label ? `${mark.color}:${mark.label}` : mark.color,
      label: mark.label || swatch.label,
      mark: swatch.mark,
      chip: swatch.chip,
      dot: swatch.dot,
      icon: null,
    };
  }
  const tone = toneOf(mark);
  return { id: tone, ...TONES[tone], icon: TONES[tone].icon };
}

/** Falls back to a calendar file the reader can open in anything. */
function downloadReminder(mark: HighlightMark) {
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replaceAll("-", "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${mark.findingId}@didyoureadthefine.ink`,
    `DTSTART;VALUE=DATE:${day}`,
    `SUMMARY:Confirm document deadline: ${mark.title}`,
    `DESCRIPTION:${mark.detail.replaceAll("\n", " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "document-reminder.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export function DocumentHighlights({
  agentId,
  document: highlighted,
  documentName,
  documentNames,
  overrides,
  removedPages,
  removedPageAt,
  onReread,
  onHide,
}: {
  agentId: string;
  document: HighlightedDocument;
  documentName: string;
  documentNames?: string[];
  overrides?: Record<string, HighlightOverride>;
  /** Pages the reader deleted on an earlier visit. */
  removedPages?: number[];
  /** When each of those pages went, so the history can lead with the newest. */
  removedPageAt?: Record<string, string>;
  /** Asks the page to repaint once a document has been read again. */
  onReread?: () => void;
  onHide?: () => void;
}) {
  // Filter chips, held by paint id so a colour of the reader's own filters too.
  const [active, setActive] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // One place applies reader edits: saved ones seed the state, new ones land
  // here first and are saved in the background.
  const [edits, setEdits] = useState<Record<string, HighlightOverride>>(() => overrides ?? {});
  const [hidden, setHidden] = useState<number[]>(() => removedPages ?? []);
  const [hiddenAt, setHiddenAt] = useState<Record<string, string>>(() => removedPageAt ?? {});
  // The chat can change the highlights too. When the server sends a fresh copy,
  // it is the truth, so the local state starts again from it.
  const [seeded, setSeeded] = useState({ overrides, removedPages });
  if (seeded.overrides !== overrides || seeded.removedPages !== removedPages) {
    setSeeded({ overrides, removedPages });
    setEdits(overrides ?? {});
    setHidden(removedPages ?? []);
    setHiddenAt(removedPageAt ?? {});
  }
  const [saveError, setSaveError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [folded, setFolded] = useState<string[]>([]);
  const [rereading, setRereading] = useState<string | null>(null);
  const [rereadNote, setRereadNote] = useState("");
  const [reminder, setReminder] = useState<{ text: string; link?: string; settings?: boolean } | null>(null);
  const [addingReminder, setAddingReminder] = useState(false);

  /**
   * Tries the reader's own Google Calendar first, since that is where they will
   * actually see it, and downloads a calendar file when that is not available.
   */
  /** Throws away every edit and puts the machine's own highlights back. */
  async function restoreAll() {
    const previousEdits = edits;
    const previousHidden = hidden;
    const previousHiddenAt = hiddenAt;
    setEdits({});
    setHidden([]);
    setHiddenAt({});
    setSaveError("");
    try {
      const response = await fetch(`/api/agents/${agentId}/highlights`, { method: "DELETE" });
      if (!response.ok) throw new Error("restore failed");
    } catch {
      setEdits(previousEdits);
      setHidden(previousHidden);
      setHiddenAt(previousHiddenAt);
      setSaveError("The highlights were not restored. Try again.");
    }
  }

  /** Deletes a whole page from the marked-up view, or puts one back. */
  async function setPagesRemoved(pages: number[], removed: boolean, what = "That page") {
    if (pages.length === 0) return;
    const previous = hidden;
    const previousAt = hiddenAt;
    const now = new Date().toISOString();
    setHidden((current) =>
      removed
        ? [...new Set([...current, ...pages])].sort((a, b) => a - b)
        : current.filter((value) => !pages.includes(value)),
    );
    setHiddenAt((current) => {
      const next = { ...current };
      for (const page of pages) {
        if (removed) next[String(page)] = now;
        else delete next[String(page)];
      }
      return next;
    });
    setSaveError("");
    setRereadNote("");
    setSelected(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/highlights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, hidden: removed }),
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setHidden(previous);
      setHiddenAt(previousAt);
      setSaveError(`${what} was not ${removed ? "deleted" : "put back"}. Try again.`);
    }
  }

  async function addReminder(mark: HighlightMark) {
    setAddingReminder(true);
    setReminder(null);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Confirm: ${mark.title}`, detail: mark.detail, date: mark.date }),
      });
      const result = (await response.json()) as { link?: string; date?: string; reason?: string };
      if (response.ok) {
        setReminder({ text: `Added to your Google Calendar on ${result.date}.`, link: result.link });
        return;
      }
      // A calendar file always works, so the reminder is never simply lost.
      downloadReminder(mark);
      setReminder({
        text:
          result.reason === "no_scope"
            ? "Google has not granted calendar access, so a calendar file was downloaded instead. Reconnect Google to allow it."
            : "No Google account is connected, so a calendar file was downloaded instead. Connect one to write reminders straight to your calendar.",
        settings: result.reason !== "failed",
      });
    } catch {
      downloadReminder(mark);
      setReminder({ text: "Could not reach the calendar, so a calendar file was downloaded instead." });
    } finally {
      setAddingReminder(false);
    }
  }

  const editOf = (mark: HighlightMark): HighlightOverride | undefined => edits[mark.key];
  const shownMark = (mark: HighlightMark): HighlightMark | null => {
    const edit = editOf(mark);
    if (edit?.removed) return null;
    if (!edit) return mark;
    return {
      ...mark,
      kind: edit.kind ?? mark.kind,
      severity: edit.severity ?? mark.severity,
      title: edit.title ?? mark.title,
      // A category chosen later replaces a colour chosen earlier, and vice versa.
      color: edit.kind ? undefined : (edit.color ?? mark.color),
      label: edit.kind ? undefined : (edit.label ?? mark.label),
    };
  };

  async function save(key: string, override: HighlightOverride | null) {
    const previous = edits[key];
    setEdits((current) => {
      const next = { ...current };
      if (override) next[key] = { ...override, at: new Date().toISOString() };
      else delete next[key];
      return next;
    });
    setSaveError("");
    try {
      const response = await fetch(`/api/agents/${agentId}/highlights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(override ? { key, ...override } : { key, reset: true }),
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setEdits((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setSaveError("That change was not saved. Try again.");
    }
  }

  const shownPages = useMemo(
    () => highlighted.pages.filter((page) => !hidden.includes(page.page)),
    [highlighted.pages, hidden],
  );
  /** Highlights still on screen: a deleted page takes its own marks with it. */
  const liveKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const page of shownPages) {
      for (const segment of page.segments) if (segment.mark) keys.add(segment.mark.key);
    }
    return keys;
  }, [shownPages]);

  /** Every group on show, the five categories first and then the reader's own. */
  const paints = useMemo(() => {
    const groups = new Map<string, Paint & { count: number }>();
    for (const tone of TONE_ORDER) groups.set(tone, { id: tone, ...TONES[tone], count: 0 });
    for (const mark of highlighted.marks) {
      if (edits[mark.key]?.removed || !liveKeys.has(mark.key)) continue;
      const shown = shownMark(mark);
      if (!shown) continue;
      const paint = paintOf(shown);
      const held = groups.get(paint.id);
      if (held) held.count += 1;
      else groups.set(paint.id, { ...paint, count: 1 });
    }
    return [...groups.values()].filter((group) => group.count > 0);
    // shownMark reads the same state this already depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted.marks, edits, liveKeys]);

  const rawSelected = highlighted.marks.find((mark) => mark.findingId === selected) ?? null;
  const selectedMark = rawSelected ? shownMark(rawSelected) : null;
  const shown = (paint: Paint) => active.length === 0 || active.includes(paint.id);
  const removedMarks = highlighted.marks.filter(
    (mark) => edits[mark.key]?.removed && liveKeys.has(mark.key),
  );
  /**
   * Deleted pages, but a file whose every page went is one line, not several:
   * that is what the reader did, and one Undo should bring the whole file back.
   */
  const deletedPages = () => {
    const byFile = new Map<string, { all: number[]; gone: number[] }>();
    for (const page of highlighted.pages) {
      const name = page.source ?? documentName;
      const entry = byFile.get(name) ?? { all: [], gone: [] };
      entry.all.push(page.page);
      if (hidden.includes(page.page)) entry.gone.push(page.page);
      byFile.set(name, entry);
    }
    const newest = (pages: number[]) =>
      pages.map((page) => hiddenAt[String(page)]).filter(Boolean).sort().at(-1);

    return [...byFile.entries()].flatMap(([name, { all, gone }]) => {
      if (gone.length === 0) return [];
      if (gone.length === all.length) {
        return [{
          id: `file-${name}`,
          at: newest(gone),
          label: `${name} deleted`,
          detail:
            all.length === 1
              ? "Its page was taken out of the marked-up view."
              : `All ${all.length} pages were taken out of the marked-up view.`,
          undoLabel: `Undo: ${name} deleted`,
          undo: () => void setPagesRemoved(gone, false, name),
        }];
      }
      return gone.map((page) => ({
        id: `page-${page}`,
        at: hiddenAt[String(page)],
        label: `Page ${page} deleted`,
        detail: "The whole page was taken out of the marked-up view.",
        undoLabel: `Undo: page ${page} deleted`,
        undo: () => void setPagesRemoved([page], false),
      }));
    });
  };

  /** One line per change, newest first, whether it was a page or a highlight. */
  const historyEntries = [
    ...deletedPages(),
    ...highlighted.marks
      // A highlight on a deleted page is already gone; listing it twice confuses.
      .filter((mark) => liveKeys.has(mark.key))
      .map((mark) => ({ mark, edit: edits[mark.key] }))
      .filter((entry) => Boolean(entry.edit) || entry.mark.fromReader)
      .map(({ mark, edit }) => {
        const was = paintOf(mark).label;
        const shownVersion = shownMark(mark);
        const now = shownVersion ? paintOf(shownVersion).label : null;
        let label: string;
        if (mark.fromReader) {
          label = edit?.removed ? `Added from the chat, then removed` : `Added from the chat · ${now}`;
        } else if (edit?.removed) {
          label = `Removed from ${was}`;
        } else if (now !== was) {
          label = `${was} → ${now}`;
        } else {
          label = `Renamed in ${was}`;
        }
        // Undoing an addition hides it, the same as removing any other highlight;
        // undoing anything else puts the analysis's own version back.
        const undone: HighlightOverride | null = mark.fromReader && !edit?.removed ? { removed: true } : null;
        return {
          id: mark.key,
          at: edit?.at ?? (mark.fromReader ? mark.createdAt : undefined),
          label,
          detail: `“${mark.quote}”`,
          undoLabel: `Undo: ${mark.title}`,
          undo: () => void save(mark.key, undone),
        };
      }),
  ].sort((a, b) => {
    // Changes saved before this list kept times sit below the ones that have them.
    if (a.at && b.at) return b.at.localeCompare(a.at);
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
  const changeCount = historyEntries.length;
  /** The pages still on show, gathered under the file each one came from. */
  const documents = useMemo(() => {
    const groups = new Map<string, typeof shownPages>();
    for (const page of shownPages) {
      const name = page.source ?? documentName;
      groups.set(name, [...(groups.get(name) ?? []), page]);
    }
    return [...groups.entries()].map(([name, group]) => ({
      name,
      pages: group,
      marks: group.reduce(
        (sum, page) => sum + page.segments.filter((segment) => segment.mark && shownMark(segment.mark)).length,
        0,
      ),
    }));
    // shownMark reads the same edits this already depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownPages, documentName, edits]);

  /** Reads one document again, in case its highlights came out thin. */
  async function reread(source: string) {
    setRereading(source);
    setRereadNote("");
    setSaveError("");
    try {
      const response = await fetch(`/api/agents/${agentId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const result = (await response.json()) as { added?: number; aiError?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "re-read failed");
      setRereadNote(
        result.aiError
          ? "The highlights were refreshed, but the deeper re-read is unavailable right now."
          : result.added
            ? `Added ${result.added} highlight${result.added === 1 ? "" : "s"} to ${source}.`
            : `Read ${source} again. Nothing else stood out.`,
      );
      onReread?.();
    } catch {
      setSaveError(`${source} could not be read again. Try again.`);
    } finally {
      setRereading(null);
    }
  }

  const total = paints.reduce((sum, paint) => sum + paint.count, 0);
  const files = documentNames?.length ? documentNames : [documentName];
  // Page numbers run on across documents, so each card says which file it is from.
  const showSources = files.length > 1;

  function toggleTone(id: string) {
    setActive((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <aside className="flex min-w-0 flex-col bg-[#f3f7ef] lg:h-[calc(100vh-4rem)]" aria-label={`Highlighted text of ${documentName}`}>
      <div className="border-b border-[#d4dfd1] px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase text-[#4c765a]">Marked-up document</p>
          <div className="-mt-1 flex shrink-0 flex-col items-end gap-1.5">
            {onHide && (
              <button
                type="button"
                onClick={onHide}
                aria-expanded
                className="inline-flex items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d5640] hover:bg-[#eef6ec]"
              >
                <PanelRightClose size={14} />
                Hide
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowHistory((value) => !value); setSelected(null); }}
              aria-expanded={showHistory}
              aria-label={
                changeCount > 0
                  ? `History (${changeCount} ${changeCount === 1 ? "change" : "changes"})`
                  : "History"
              }
              title="History"
              className={`inline-flex items-center justify-center p-1 transition ${
                showHistory || changeCount > 0
                  ? "text-[#245c39]"
                  : "text-[#7d9a86] hover:text-[#2d5640]"
              }`}
            >
              <History size={18} />
            </button>
          </div>
        </div>
        <h2 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold text-[#173c28]">
          <FileText size={20} className="shrink-0" />
          <span className="truncate">{files[0]}</span>
        </h2>
        {showSources && (
          <p className="mt-1 truncate text-xs font-semibold text-[#4c765a]">
            + {files.slice(1).join(", ")}
          </p>
        )}
        <p className="mt-1.5 text-xs leading-5 text-[#63776a]">
          {total > 0
            ? `${total} passage${total === 1 ? "" : "s"} marked across ${highlighted.pages.length} page${highlighted.pages.length === 1 ? "" : "s"}${showSources ? ` in ${files.length} documents` : ""}. Tap a highlight to see why.`
            : "Nothing stood out in the extracted text. Read it in full below."}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {paints.map(({ id, label, icon: Icon, chip, dot, count }) => {
            const on = active.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTone(id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${chip} ${on ? "ring-2 ring-[#2c6440]" : "opacity-90 hover:opacity-100"}`}
              >
                {Icon ? <Icon size={13} /> : <span className={`size-2.5 rounded-full ${dot}`} />}
                {label}
                <span className={`grid size-4 place-items-center rounded-full text-[10px] text-white ${dot}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {active.length > 0 && (
            <button
              type="button"
              onClick={() => setActive([])}
              className="inline-flex items-center gap-1 rounded-full border border-[#c6d4c3] bg-white px-2.5 py-1 text-xs font-bold text-[#3c5a47]"
            >
              <X size={12} />
              Show all
            </button>
          )}
        </div>
      </div>

      {rereadNote && (
        <p role="status" className="border-b border-[#cfe0d2] bg-[#eef6ec] px-5 py-2 text-xs font-semibold text-[#2d6841] sm:px-7">
          {rereadNote}
        </p>
      )}

      {saveError && (
        <p role="alert" className="border-b border-[#f0d5cf] bg-[#fff0ed] px-5 py-2 text-xs font-semibold text-[#a43b32] sm:px-7">
          {saveError}
        </p>
      )}

      {showHistory && (
        <div className="border-b border-[#d4dfd1] bg-[#fffef9] px-5 py-3 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#4c765a]">Your changes</p>
              <p className="mt-0.5 text-xs leading-5 text-[#687a6e]">
                {changeCount === 0
                  ? "You have not changed anything yet."
                  : `${changeCount} change${changeCount === 1 ? "" : "s"}. Undo them one at a time, or put everything back.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              aria-label="Close the change history"
              className="grid size-8 shrink-0 place-items-center rounded hover:bg-[#edf3ea]"
            >
              <X size={16} />
            </button>
          </div>

          {changeCount > 0 && (
            <>
              <ul className="mt-2.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {historyEntries.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2 rounded-md border border-[#e2e9de] bg-white px-2.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-[#203b2b]">{entry.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#687a6e]">{entry.detail}</span>
                    </span>
                    <button
                      type="button"
                      onClick={entry.undo}
                      aria-label={entry.undoLabel}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#c6d4c3] bg-white px-2 py-1 text-xs font-bold text-[#2d5640] hover:bg-[#eef6ec]"
                    >
                      <Undo2 size={12} />
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void restoreAll()}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-[#b9cdb8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d6841] hover:bg-[#eef6ec]"
              >
                <RotateCcw size={13} />
                Restore the original highlights
              </button>
            </>
          )}
        </div>
      )}

      {selectedMark && (
        <div className="sticky top-0 z-10 border-b border-[#d4dfd1] bg-[#fffef9] px-5 py-3 shadow-sm sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${paintOf(selectedMark).chip}`}>
                  {paintOf(selectedMark).label}
                </span>
                {selectedMark.fromReader && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#c6d4c3] bg-white px-2 py-0.5 text-[11px] font-bold text-[#4c765a]">
                    <MessageSquareText size={11} />
                    From the chat
                  </span>
                )}
              </span>
              <h3 className="mt-1.5 text-sm font-bold text-[#203b2b]">{selectedMark.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#526659]">{selectedMark.detail}</p>
              {selectedMark.date && (
                <p className="mt-1 text-xs font-semibold text-[#6f5a12]">Date found: {selectedMark.date}</p>
              )}
              {selectedMark.kind === "deadline" && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={addingReminder}
                    onClick={() => void addReminder(selectedMark)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#b9cdb8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d6841] hover:bg-[#eef6ec] disabled:opacity-50"
                  >
                    <CalendarPlus size={14} />
                    {addingReminder ? "Adding to your calendar..." : "Set reminder"}
                  </button>
                  {reminder && (
                    <p className="mt-1.5 text-xs leading-5 text-[#4c765a]">
                      {reminder.text}
                      {reminder.link && (
                        <>
                          {" "}
                          <a href={reminder.link} target="_blank" rel="noreferrer" className="font-bold underline">
                            Open it
                          </a>
                        </>
                      )}
                      {reminder.settings && (
                        <>
                          {" "}
                          <Link href="/settings" className="font-bold underline">
                            Connect Google
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* 읽는 사람은 색을 고르지 않는다. 남길지 지울지만 정한다. */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#e2e9de] pt-2.5">
                <button
                  type="button"
                  onClick={() => void save(rawSelected!.key, { removed: true })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#e0a79d] bg-white px-2.5 py-1.5 text-xs font-bold text-[#8f2f23] hover:bg-[#fff0ed]"
                >
                  <Trash2 size={13} />
                  Remove this highlight
                </button>
                {edits[rawSelected!.key] && (
                  <button
                    type="button"
                    onClick={() => void save(rawSelected!.key, null)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2.5 py-1.5 text-xs font-bold text-[#3c5a47] hover:bg-[#eef6ec]"
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close highlight detail"
              className="grid size-8 shrink-0 place-items-center rounded hover:bg-[#edf3ea]"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
        {documents.map((document) => {
          const open = !folded.includes(document.name);
          return (
            <section key={document.name} className="rounded-lg border border-[#dce5d9] bg-[#f8fbf6]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() =>
                    setFolded((current) =>
                      current.includes(document.name)
                        ? current.filter((name) => name !== document.name)
                        : [...current, document.name],
                    )
                  }
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[#eef4ea]"
                >
                  {open ? <ChevronDown size={16} className="shrink-0 text-[#4c765a]" /> : <ChevronRight size={16} className="shrink-0 text-[#4c765a]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#203b2b]">{document.name}</span>
                    <span className="block text-[11px] text-[#708477]">
                      {document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {document.marks} highlight
                      {document.marks === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={rereading !== null}
                  onClick={() => void reread(document.name)}
                  title={`Read ${document.name} again`}
                  aria-label={`Read ${document.name} again`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2 py-1 text-[11px] font-bold text-[#2d5640] hover:bg-[#eef6ec] disabled:opacity-50"
                >
                  {rereading === document.name ? (
                    <LoaderCircle size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {rereading === document.name ? "Reading..." : "Re-read"}
                </button>
                <button
                  type="button"
                  onClick={() => void setPagesRemoved(document.pages.map((page) => page.page), true, document.name)}
                  title={`Delete ${document.name}`}
                  aria-label={`Delete ${document.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded text-[#9aa79e] transition hover:bg-[#fbe6e2] hover:text-[#8f2f23]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {open && (
                <div className="space-y-3 px-3 pb-3">
                  {document.pages.map((page) => (
              <article key={page.page} className="rounded-lg border border-[#dce5d9] bg-[#fffef9] p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7b897f]">
                    <span>Page {page.page}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void setPagesRemoved([page.page], true)}
                    title={`Delete page ${page.page}`}
                    aria-label={`Delete page ${page.page}`}
                    className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded text-[#9aa79e] transition hover:bg-[#fbe6e2] hover:text-[#8f2f23]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#31473a]">
                  {page.segments.map((segment, index) => {
                    const mark = segment.mark ? shownMark(segment.mark) : null;
                    if (!mark) return <span key={index}>{segment.text}</span>;
                    const paint = paintOf(mark);
                    const dimmed = !shown(paint);
                    const isSelected = mark.findingId === selected;
                    const select = () => {
                      setReminder(null);
                      setSelected(isSelected ? null : mark.findingId);
                    };
                    return (
                      <mark
                        key={index}
                        role="button"
                        tabIndex={0}
                        title={mark.title}
                        aria-label={`${paint.label}: ${mark.title}`}
                        onClick={select}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          select();
                        }}
                        className={`cursor-pointer rounded-sm px-0.5 underline decoration-2 underline-offset-2 transition ${paint.mark} ${dimmed ? "bg-transparent text-[#8c9a90] decoration-transparent" : ""} ${isSelected ? "ring-2 ring-[#2c6440]" : ""}`}
                      >
                        {segment.text}
                      </mark>
                    );
                  })}
                </p>
              </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {shownPages.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#cfd9cb] bg-[#fbfcf9] p-4 text-center text-xs leading-6 text-[#687a6e]">
            Every page has been deleted from this view. Open History to put one back.
          </p>
        )}
        {removedMarks.length > 0 && (
          <div className="rounded-lg border border-dashed border-[#cfd9cb] bg-[#fbfcf9] p-3">
            <p className="text-[11px] font-bold uppercase text-[#708477]">Removed by you ({removedMarks.length})</p>
            <ul className="mt-2 space-y-1.5">
              {removedMarks.map((mark) => (
                <li key={mark.key} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => void save(mark.key, null)}
                    title="Put this highlight back"
                    aria-label={`Put back: ${mark.title}`}
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded border border-[#c6d4c3] bg-white text-[#3c5a47] hover:bg-[#eef6ec]"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <span className="min-w-0 text-xs leading-5 text-[#687a6e]">{mark.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {highlighted.unmatched > 0 && (
          <p className="px-1 pb-2 text-xs leading-5 text-[#7b897f]">
            {highlighted.unmatched} finding{highlighted.unmatched === 1 ? "" : "s"} could not be traced back to an exact
            sentence in the extracted text. Ask the agent about them in the chat.
          </p>
        )}
      </div>
    </aside>
  );
}
