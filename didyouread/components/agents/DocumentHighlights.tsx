"use client";

import { CalendarPlus, CircleAlert, CircleCheck, DollarSign, FileText, Highlighter, PanelRightClose, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { HighlightMark, HighlightedDocument } from "@/lib/document-highlights";
import type { FindingSeverity, HighlightKind, HighlightOverride } from "@/types/agent";

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

/** Picking a colour is picking a category; these are the two sides of it. */
const TONE_MEANS: Record<Tone, { kind: HighlightKind; severity: FindingSeverity }> = {
  red_flag: { kind: "concern", severity: "red_flag" },
  concern: { kind: "concern", severity: "important" },
  deadline: { kind: "deadline", severity: "important" },
  financial: { kind: "financial", severity: "important" },
  favorable: { kind: "favorable", severity: "info" },
};

export function toneOf(mark: HighlightMark): Tone {
  if (mark.kind === "concern") return mark.severity === "red_flag" ? "red_flag" : "concern";
  return mark.kind;
}

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
  onHide,
}: {
  agentId: string;
  document: HighlightedDocument;
  documentName: string;
  documentNames?: string[];
  overrides?: Record<string, HighlightOverride>;
  onHide?: () => void;
}) {
  const [active, setActive] = useState<Tone[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // One place applies reader edits: saved ones seed the state, new ones land
  // here first and are saved in the background.
  const [edits, setEdits] = useState<Record<string, HighlightOverride>>(() => overrides ?? {});
  const [saveError, setSaveError] = useState("");

  const editOf = (mark: HighlightMark): HighlightOverride | undefined => edits[mark.key];
  const shownMark = (mark: HighlightMark): HighlightMark | null => {
    const edit = editOf(mark);
    if (edit?.removed) return null;
    if (!edit) return mark;
    return { ...mark, kind: edit.kind ?? mark.kind, severity: edit.severity ?? mark.severity };
  };

  async function save(key: string, override: HighlightOverride | null) {
    const previous = edits[key];
    setEdits((current) => {
      const next = { ...current };
      if (override) next[key] = override;
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

  const toneCounts = useMemo(() => {
    const counts: Record<Tone, number> = { red_flag: 0, concern: 0, deadline: 0, financial: 0, favorable: 0 };
    for (const mark of highlighted.marks) {
      const edit = edits[mark.key];
      if (edit?.removed) continue;
      counts[toneOf({ ...mark, kind: edit?.kind ?? mark.kind, severity: edit?.severity ?? mark.severity })] += 1;
    }
    return counts;
  }, [highlighted.marks, edits]);

  const rawSelected = highlighted.marks.find((mark) => mark.findingId === selected) ?? null;
  const selectedMark = rawSelected ? shownMark(rawSelected) : null;
  const shown = (tone: Tone) => active.length === 0 || active.includes(tone);
  const removedMarks = highlighted.marks.filter((mark) => edits[mark.key]?.removed);
  const total = TONE_ORDER.reduce((sum, tone) => sum + toneCounts[tone], 0);
  const files = documentNames?.length ? documentNames : [documentName];
  // Page numbers run on across documents, so each card says which file it is from.
  const showSources = files.length > 1;

  function toggleTone(tone: Tone) {
    setActive((current) =>
      current.includes(tone) ? current.filter((value) => value !== tone) : [...current, tone],
    );
  }

  return (
    <aside className="flex min-w-0 flex-col bg-[#f3f7ef] lg:h-[calc(100vh-4rem)]" aria-label={`Highlighted text of ${documentName}`}>
      <div className="border-b border-[#d4dfd1] px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase text-[#4c765a]">Marked-up document</p>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              aria-expanded
              className="-mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d5640] hover:bg-[#eef6ec]"
            >
              <PanelRightClose size={14} />
              Hide
            </button>
          )}
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
          {TONE_ORDER.filter((tone) => toneCounts[tone] > 0).map((tone) => {
            const { label, icon: Icon, chip, dot } = TONES[tone];
            const on = active.includes(tone);
            return (
              <button
                key={tone}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTone(tone)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${chip} ${on ? "ring-2 ring-[#2c6440]" : "opacity-90 hover:opacity-100"}`}
              >
                <Icon size={13} />
                {label}
                <span className={`grid size-4 place-items-center rounded-full text-[10px] text-white ${dot}`}>
                  {toneCounts[tone]}
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

      {selectedMark && (
        <div className="sticky top-0 z-10 border-b border-[#d4dfd1] bg-[#fffef9] px-5 py-3 shadow-sm sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONES[toneOf(selectedMark)].chip}`}>
                {TONES[toneOf(selectedMark)].label}
              </p>
              <h3 className="mt-1.5 text-sm font-bold text-[#203b2b]">{selectedMark.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#526659]">{selectedMark.detail}</p>
              {selectedMark.date && (
                <p className="mt-1 text-xs font-semibold text-[#6f5a12]">Date found: {selectedMark.date}</p>
              )}
              {selectedMark.kind === "deadline" && (
                <button
                  type="button"
                  onClick={() => downloadReminder(selectedMark)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#b9cdb8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d6841] hover:bg-[#eef6ec]"
                >
                  <CalendarPlus size={14} />
                  Set reminder
                </button>
              )}

              {/* 기계가 고른 분류를 읽는 사람이 바로잡는 자리 */}
              <div className="mt-3 border-t border-[#e2e9de] pt-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#708477]">
                  <Highlighter size={12} />
                  Change the colour
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {TONE_ORDER.map((tone) => {
                    const current = toneOf(selectedMark) === tone;
                    return (
                      <button
                        key={tone}
                        type="button"
                        title={TONES[tone].label}
                        aria-label={`Mark as ${TONES[tone].label}`}
                        aria-pressed={current}
                        onClick={() => void save(rawSelected!.key, TONE_MEANS[tone])}
                        className={`size-6 rounded-full border transition ${TONES[tone].dot} ${
                          current ? "scale-110 border-[#1e432d] ring-2 ring-[#c4dfc9]" : "border-black/20 hover:scale-105"
                        }`}
                      />
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => void save(rawSelected!.key, { removed: true })}
                    className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-[#e0a79d] bg-white px-2.5 py-1.5 text-xs font-bold text-[#8f2f23] hover:bg-[#fff0ed]"
                  >
                    <Trash2 size={13} />
                    Remove
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
                {saveError && <p role="alert" className="mt-1.5 text-xs text-[#a43b32]">{saveError}</p>}
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
        {highlighted.pages.map((page) => (
          <article key={page.page} className="rounded-lg border border-[#dce5d9] bg-[#fffef9] p-4 shadow-sm">
            <p className="mb-2 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7b897f]">
              <span>Page {page.page}</span>
              {showSources && page.source && <span className="truncate normal-case text-[#9aa79e]">· {page.source}</span>}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#31473a]">
              {page.segments.map((segment, index) => {
                const mark = segment.mark ? shownMark(segment.mark) : null;
                if (!mark) return <span key={index}>{segment.text}</span>;
                const tone = toneOf(mark);
                const dimmed = !shown(tone);
                const isSelected = mark.findingId === selected;
                const select = () => setSelected(isSelected ? null : mark.findingId);
                return (
                  <mark
                    key={index}
                    role="button"
                    tabIndex={0}
                    title={mark.title}
                    aria-label={`${TONES[tone].label}: ${mark.title}`}
                    onClick={select}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      select();
                    }}
                    className={`cursor-pointer rounded-sm px-0.5 underline decoration-2 underline-offset-2 transition ${TONES[tone].mark} ${dimmed ? "bg-transparent text-[#8c9a90] decoration-transparent" : ""} ${isSelected ? "ring-2 ring-[#2c6440]" : ""}`}
                  >
                    {segment.text}
                  </mark>
                );
              })}
            </p>
          </article>
        ))}
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
