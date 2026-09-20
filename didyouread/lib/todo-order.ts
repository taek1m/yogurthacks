import type { TodoItem } from "@/types/agent";

/**
 * Soonest first; anything without a date waits at the bottom. Kept free of
 * server imports so the header can sort what it receives as well.
 */
export function byDueDate(a: TodoItem, b: TodoItem): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}
