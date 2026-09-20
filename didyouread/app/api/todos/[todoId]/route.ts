import { deleteTodo, setTodoDone } from "@/lib/todo-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ todoId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { todoId } = await params;
    const payload = (await request.json()) as { done?: unknown };
    if (typeof payload.done !== "boolean") {
      return Response.json({ error: "Only the done flag can be changed" }, { status: 400 });
    }
    const todo = await setTodoDone(ownerId, todoId, payload.done);
    if (!todo) return Response.json({ error: "Task not found" }, { status: 404 });
    return Response.json({ todo });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not update the task" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ todoId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { todoId } = await params;
    if (!(await deleteTodo(ownerId, todoId))) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not remove the task" }, { status: 500 });
  }
}
