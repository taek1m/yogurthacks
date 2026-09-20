import type { AgentTask, Finding } from "@/types/agent";

/** Someone asking the agent to remember something, rather than just asking about it. */
const TODO_REQUEST = /\b(to-?\s?do|todo|task list|reminder|remind me|add (it |this |that )?to (my |the )?list|put (it |this |that )?on (my |the )?list)\b/i;

export function asksForTask(message: string): boolean {
  return TODO_REQUEST.test(message);
}

/** Pulls a YYYY-MM-DD out of the shapes documents actually use. */
export function readDueDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const named = trimmed.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (named) {
    const month = new Date(`${named[1]} 1, 2000`).getMonth() + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
  }

  const slashed = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashed) {
    const year = slashed[3].length === 2 ? `20${slashed[3]}` : slashed[3];
    return `${year}-${slashed[1].padStart(2, "0")}-${slashed[2].padStart(2, "0")}`;
  }
  return undefined;
}

export function buildTask(input: { title?: unknown; detail?: unknown; dueDate?: unknown }): AgentTask | null {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 160) : "";
  if (title.length < 2) return null;
  return {
    id: crypto.randomUUID(),
    title,
    detail: typeof input.detail === "string" && input.detail.trim() ? input.detail.trim().slice(0, 400) : undefined,
    dueDate: readDueDate(input.dueDate),
    done: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * When the model cannot be reached, the deadlines already pulled out of the
 * document still make a useful list.
 */
export function tasksFromDeadlines(deadlines: Finding[]): AgentTask[] {
  return deadlines.slice(0, 5).map((finding) => {
    const task = buildTask({
      title: finding.title,
      detail: finding.quote,
      dueDate: finding.date ?? finding.quote,
    });
    return task;
  }).filter((task): task is AgentTask => task !== null);
}
