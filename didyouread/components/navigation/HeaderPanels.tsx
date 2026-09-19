"use client";

import { AlertCircle, Bell, Check, CircleCheck, Clock3, ListTodo } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentAgent } from "@/types/agent";

interface PanelItem {
  id: string;
  agentId: string;
  title: string;
  detail: string;
  tone: "attention" | "deadline" | "error";
}

export function HeaderPanels() {
  const [agents, setAgents] = useState<DocumentAgent[]>([]);
  const [active, setActive] = useState<"notifications" | "todos" | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("agent-garden:completed-todos");
    if (stored) {
      try {
        const saved = new Set(JSON.parse(stored) as string[]);
        window.setTimeout(() => setCompleted(saved), 0);
      } catch { /* Ignore damaged local state. */ }
    }
    const load = async () => {
      try {
        const response = await fetch("/api/agents");
        if (response.ok) {
          const result = (await response.json()) as { agents: DocumentAgent[] };
          setAgents(result.agents);
        }
      } catch {
        // The header remains usable when notifications cannot load.
      }
    };
    void load();
    window.addEventListener("agent-garden:changed", load);
    return () => window.removeEventListener("agent-garden:changed", load);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const notifications = useMemo<PanelItem[]>(() => agents.flatMap((agent) => {
    const items: PanelItem[] = [];
    if (agent.status === "error") items.push({ id: `${agent.id}:error`, agentId: agent.id, title: agent.name, detail: "Analysis failed and needs another look", tone: "error" });
    if (agent.attentionCount > 0) items.push({ id: `${agent.id}:attention`, agentId: agent.id, title: agent.name, detail: `${agent.attentionCount} item${agent.attentionCount === 1 ? " needs" : "s need"} attention`, tone: "attention" });
    if (agent.deadlineCount > 0) items.push({ id: `${agent.id}:deadline`, agentId: agent.id, title: agent.name, detail: `${agent.deadlineCount} deadline${agent.deadlineCount === 1 ? "" : "s"} to review`, tone: "deadline" });
    return items;
  }), [agents]);

  const todos = useMemo<PanelItem[]>(() => agents.flatMap((agent) => {
    const items: PanelItem[] = [];
    if (agent.attentionCount > 0) items.push({ id: `${agent.id}:review`, agentId: agent.id, title: `Review ${agent.name}`, detail: agent.documentName, tone: "attention" });
    if (agent.deadlineCount > 0) items.push({ id: `${agent.id}:dates`, agentId: agent.id, title: `Confirm dates in ${agent.name}`, detail: agent.documentName, tone: "deadline" });
    if (agent.status === "processing") items.push({ id: `${agent.id}:processing`, agentId: agent.id, title: `Check ${agent.name}`, detail: "Analysis is still processing", tone: "deadline" });
    return items;
  }), [agents]);

  function toggleTodo(id: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      window.localStorage.setItem("agent-garden:completed-todos", JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <div ref={container} className="relative flex items-center gap-1">
      <button type="button" title="Notifications" aria-label="Notifications" aria-expanded={active === "notifications"} onClick={() => setActive((value) => value === "notifications" ? null : "notifications")} className="relative grid size-10 place-items-center rounded-md border border-[#d5e0d1] bg-white text-[#315d40] hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]">
        <Bell size={18} />
        {notifications.length > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-[#b74736] text-[10px] font-bold text-white">{Math.min(9, notifications.length)}</span>}
      </button>
      <button type="button" title="What to do" aria-label="What to do list" aria-expanded={active === "todos"} onClick={() => setActive((value) => value === "todos" ? null : "todos")} className="relative inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d5e0d1] bg-white px-2.5 text-[#315d40] hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]">
        <ListTodo size={18} /><span className="hidden text-sm font-semibold xl:inline">To do</span>
        {todos.filter((todo) => !completed.has(todo.id)).length > 0 && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-[#d88932]" />}
      </button>

      {active && (
        <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-[#d5e0d1] bg-white shadow-xl">
          <div className="border-b border-[#e1e9de] px-4 py-3">
            <p className="text-xs font-bold uppercase text-[#708477]">{active === "notifications" ? "Notifications" : "What to do"}</p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-[#183126]">{active === "notifications" ? "Garden updates" : "Your review list"}</h2>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {active === "notifications" ? (
              notifications.length > 0 ? notifications.map((item) => (
                <Link key={item.id} href={`/agents/${item.agentId}`} onClick={() => setActive(null)} className="flex gap-3 rounded px-3 py-3 hover:bg-[#f0f6ed]">
                  {item.tone === "deadline" ? <Clock3 size={17} className="mt-0.5 shrink-0 text-[#a06624]" /> : <AlertCircle size={17} className="mt-0.5 shrink-0 text-[#a34537]" />}
                  <span className="min-w-0"><span className="block truncate text-sm font-bold">{item.title}</span><span className="block text-xs leading-5 text-[#687a6e]">{item.detail}</span></span>
                </Link>
              )) : <EmptyPanel label="No new notifications" />
            ) : (
              todos.length > 0 ? todos.map((item) => {
                const done = completed.has(item.id);
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded px-3 py-3 hover:bg-[#f0f6ed]">
                    <button type="button" aria-label={`${done ? "Mark incomplete" : "Complete"}: ${item.title}`} onClick={() => toggleTodo(item.id)} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${done ? "border-[#3f7d52] bg-[#3f7d52] text-white" : "border-[#9eb29d] bg-white"}`}>{done && <Check size={13} />}</button>
                    <Link href={`/agents/${item.agentId}`} onClick={() => setActive(null)} className="min-w-0 flex-1"><span className={`block truncate text-sm font-bold ${done ? "text-[#859087] line-through" : ""}`}>{item.title}</span><span className="block truncate text-xs leading-5 text-[#687a6e]">{item.detail}</span></Link>
                  </div>
                );
              }) : <EmptyPanel label="Nothing needs review right now" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center"><CircleCheck size={25} className="mx-auto text-[#43825a]" /><p className="mt-2 text-sm text-[#687a6e]">{label}</p></div>;
}
