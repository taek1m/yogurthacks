"use client";

import { CalendarPlus, CircleAlert, CircleCheck, DollarSign, HelpCircle, Quote } from "lucide-react";
import type { AgentAnalysis, Finding } from "@/types/agent";

function Findings({ findings, empty, deadline = false }: { findings: Finding[]; empty: string; deadline?: boolean }) {
  if (findings.length === 0) return <p className="text-sm text-[#6b7c70]">{empty}</p>;
  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <article key={finding.id} className="border-l-2 border-[#91b998] pl-3">
          <h3 className="text-sm font-bold text-[#203b2b]">{finding.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#526659]">{finding.detail}</p>
          <blockquote className="mt-2 flex gap-2 bg-[#f6f8f3] p-2 text-xs leading-5 text-[#56665b]"><Quote size={14} className="mt-0.5 shrink-0" /><span>“{finding.quote}” <strong className="whitespace-nowrap">{finding.page ? `Page ${finding.page}` : "Page not found"}</strong></span></blockquote>
          {deadline && <button type="button" onClick={() => downloadReminder(finding)} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#b9cdb8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#2d6841] hover:bg-[#eef6ec]"><CalendarPlus size={14} />Set reminder</button>}
        </article>
      ))}
    </div>
  );
}

function downloadReminder(finding: Finding) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replaceAll("-", "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `UID:${finding.id}@didyoureadthefine.ink`, `DTSTART;VALUE=DATE:${tomorrow}`, `SUMMARY:Confirm document deadline: ${finding.title}`, `DESCRIPTION:${finding.detail.replaceAll("\n", " ")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "document-reminder.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export function AnalysisPanel({ analysis, documentName, sourceKind = "pdf" }: { analysis: AgentAnalysis; documentName: string; sourceKind?: "pdf" | "topic" }) {
  const sections = [
    { title: "Favorable terms", icon: CircleCheck, findings: analysis.favorableTerms, empty: "Not found in the extracted text." },
    { title: "Concerns", icon: CircleAlert, findings: analysis.concerns, empty: "No clear concerns found. Needs confirmation." },
    { title: "Deadlines", icon: CalendarPlus, findings: analysis.deadlines, empty: "No explicit deadlines found. Needs confirmation.", deadline: true },
    { title: "Financial details", icon: DollarSign, findings: analysis.financialDetails, empty: "No clear financial details found." },
    { title: "Suggested questions", icon: HelpCircle, findings: analysis.suggestedQuestions, empty: "No suggested questions." },
  ];
  return (
    <aside className="bg-[#f3f7ef] px-5 py-6 sm:px-8" aria-label={`Analysis of ${documentName}`}>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase text-[#4c765a]">{sourceKind === "topic" ? "Saved session" : "Saved analysis"}</p>
        <h2 className="font-display text-2xl font-semibold text-[#173c28]">{sourceKind === "topic" ? "Agent guide" : "What this document says"}</h2>
        <p className="mt-2 text-sm leading-6 text-[#506559]">{analysis.summary}</p>
      </div>
      <div className="space-y-7">
        {sections.map(({ title, icon: Icon, findings, empty, deadline }) => (
          <section key={title} className="border-t border-[#d4dfd1] pt-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1e432d]"><Icon size={17} />{title}</h2>
            <Findings findings={findings} empty={empty} deadline={deadline} />
          </section>
        ))}
      </div>
    </aside>
  );
}
