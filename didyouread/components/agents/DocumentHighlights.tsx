"use client";

import { CalendarPlus, CircleAlert, CircleCheck, DollarSign, FileText, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { HighlightMark, HighlightedDocument } from "@/lib/document-highlights";

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
  document: highlighted,
  documentName,
}: {
  document: HighlightedDocument;
  documentName: string;
}) {
  const [active, setActive] = useState<Tone[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const toneCounts = useMemo(() => {
    const counts: Record<Tone, number> = { red_flag: 0, concern: 0, deadline: 0, financial: 0, favorable: 0 };
    for (const mark of highlighted.marks) counts[toneOf(mark)] += 1;
    return counts;
  }, [highlighted.marks]);

  const selectedMark = highlighted.marks.find((mark) => mark.findingId === selected) ?? null;
  const shown = (tone: Tone) => active.length === 0 || active.includes(tone);
  const total = highlighted.marks.length;

  function toggleTone(tone: Tone) {
    setActive((current) =>
      current.includes(tone) ? current.filter((value) => value !== tone) : [...current, tone],
    );
  }

  return (
    <aside className="flex min-w-0 flex-col bg-[#f3f7ef]" aria-label={`Highlighted text of ${documentName}`}>
      <div className="border-b border-[#d4dfd1] px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase text-[#4c765a]">Marked-up document</p>
        <h2 className="mt-0.5 flex items-center gap-2 font-display text-2xl font-semibold text-[#173c28]">
          <FileText size={20} className="shrink-0" />
          <span className="truncate">{documentName}</span>
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-[#63776a]">
          {total > 0
            ? `${total} passage${total === 1 ? "" : "s"} marked across ${highlighted.pages.length} page${highlighted.pages.length === 1 ? "" : "s"}. Tap a highlight to see why.`
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

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
        {highlighted.pages.map((page) => (
          <article key={page.page} className="rounded-lg border border-[#dce5d9] bg-[#fffef9] p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#7b897f]">Page {page.page}</p>
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#31473a]">
              {page.segments.map((segment, index) => {
                const mark = segment.mark;
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
