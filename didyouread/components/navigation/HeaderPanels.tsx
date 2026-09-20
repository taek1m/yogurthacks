"use client";

import { CalendarClock, Check, CircleCheck, ListTodo, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { byDueDate } from "@/lib/todo-order";
import type { TodoItem } from "@/types/agent";

const CHANGED_EVENT = "agent-garden:todos-changed";
/** Long enough to read the undo offer, short enough to stay out of the way. */
const UNDO_MS = 6000;
const FADE_MS = 400;

export function notifyTodosChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

async function fetchOpenTodos(): Promise<TodoItem[]> {
  const response = await fetch("/api/todos");
  if (!response.ok) return [];
  const result = (await response.json()) as { todos: TodoItem[] };
  // The route sorts too; doing it here keeps the panel right whatever arrives.
  return result.todos.filter((todo) => !todo.done).sort(byDueDate);
}

function dueLabel(dueDate?: string) {
  if (!dueDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(`${dueDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "text-[#a34537]" };
  if (days === 0) return { text: "Today", tone: "text-[#a06624]" };
  if (days === 1) return { text: "Tomorrow", tone: "text-[#a06624]" };
  if (days <= 7) return { text: `In ${days} days`, tone: "text-[#4c765a]" };
  return { text: new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), tone: "text-[#687a6e]" };
}

export function HeaderPanels() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [open, setOpen] = useState(false);
  // Ticked but still on screen, fading out before it leaves the list.
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<TodoItem | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchOpenTodos()
        .then((list) => { if (alive) setTodos(list); })
        // The header stays usable when the list cannot load.
        .catch(() => undefined);
    };
    load();
    window.addEventListener(CHANGED_EVENT, load);
    window.addEventListener("agent-garden:changed", load);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED_EVENT, load);
      window.removeEventListener("agent-garden:changed", load);
    };
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  async function complete(todo: TodoItem) {
    setFading((current) => new Set(current).add(todo.id));
    window.setTimeout(() => {
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      setFading((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }, FADE_MS);

    setUndo(todo);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);

    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    }).catch(() => undefined);
  }

  async function undoComplete() {
    const todo = undo;
    if (!todo) return;
    setUndo(null);
    window.clearTimeout(undoTimer.current);
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: false }),
    }).catch(() => undefined);
    notifyTodosChanged();
  }

  return (
    <div ref={container} className="relative flex items-center gap-1">
      <button
        type="button"
        title="What to do"
        aria-label="What to do list"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d5e0d1] bg-white px-2.5 text-[#315d40] hover:bg-[#eff7ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327a4a]"
      >
        <ListTodo size={18} />
        <span className="hidden text-sm font-semibold xl:inline">To do</span>
        {todos.length > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#d88932] text-[10px] font-bold text-white">
            {Math.min(9, todos.length)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-[#d5e0d1] bg-white shadow-xl">
          <div className="border-b border-[#e1e9de] px-4 py-3">
            <p className="text-xs font-bold uppercase text-[#708477]">What to do</p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-[#183126]">Your to-do list</h2>
            <p className="mt-1 text-xs leading-5 text-[#687a6e]">Soonest first. Ask an agent to add something and it lands here.</p>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {todos.length > 0 ? (
              todos.map((todo) => {
                const due = dueLabel(todo.dueDate);
                const leaving = fading.has(todo.id);
                return (
                  <div
                    key={todo.id}
                    className={`flex items-start gap-3 rounded px-3 py-3 transition-all duration-[400ms] hover:bg-[#f0f6ed] ${
                      leaving ? "translate-x-3 opacity-0" : "opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`Complete: ${todo.title}`}
                      onClick={() => void complete(todo)}
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition ${
                        leaving ? "border-[#3f7d52] bg-[#3f7d52] text-white" : "border-[#9eb29d] bg-white hover:border-[#3f7d52]"
                      }`}
                    >
                      {leaving && <Check size={13} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-5 text-[#183126]">{todo.title}</p>
                      {todo.detail && <p className="mt-0.5 text-xs leading-5 text-[#687a6e]">{todo.detail}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {due && (
                          <span className={`inline-flex items-center gap-1 font-semibold ${due.tone}`}>
                            <CalendarClock size={12} />
                            {due.text}
                          </span>
                        )}
                        {todo.agentId && todo.agentName && (
                          <Link
                            href={`/agents/${todo.agentId}`}
                            onClick={() => setOpen(false)}
                            className="truncate text-[#4c765a] hover:underline"
                          >
                            {todo.agentName}
                          </Link>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center">
                <CircleCheck size={25} className="mx-auto text-[#43825a]" />
                <p className="mt-2 text-sm text-[#687a6e]">Nothing to do right now</p>
              </div>
            )}
          </div>

          {undo && (
            <div className="flex items-center justify-between gap-3 border-t border-[#e1e9de] bg-[#f4f8f2] px-4 py-2.5">
              <p className="min-w-0 truncate text-xs text-[#4a5c50]">
                Completed <strong className="font-semibold">{undo.title}</strong>
              </p>
              <button
                type="button"
                onClick={() => void undoComplete()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#c6d4c3] bg-white px-2.5 py-1 text-xs font-bold text-[#2d5640] hover:bg-[#eef6ec]"
              >
                <RotateCcw size={13} />
                Undo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
