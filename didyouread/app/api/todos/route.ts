import { createTodos, listTodos } from "@/lib/todo-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import type { TodoItem } from "@/types/agent";

export async function GET() {
  try {
    const ownerId = await requireUserId();
    return Response.json({ todos: await listTodos(ownerId) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not load the list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireUserId();
    const payload = (await request.json()) as { title?: unknown; detail?: unknown; dueDate?: unknown };
    const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 180) : "";
    if (!title) return Response.json({ error: "A task needs a title" }, { status: 400 });

    const todo: TodoItem = {
      id: crypto.randomUUID(),
      ownerId,
      title,
      detail: typeof payload.detail === "string" ? payload.detail.trim().slice(0, 400) : undefined,
      dueDate: typeof payload.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate) ? payload.dueDate : undefined,
      done: false,
      createdAt: new Date().toISOString(),
    };
    const [created] = await createTodos([todo]);
    return Response.json({ todo: created }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not add the task" }, { status: 500 });
  }
}
