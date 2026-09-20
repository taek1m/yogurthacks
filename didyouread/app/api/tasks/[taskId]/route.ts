import { deleteTask, setTaskDone } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { taskId } = await params;
    const payload = (await request.json()) as { done?: unknown };
    if (typeof payload.done !== "boolean") {
      return Response.json({ error: "done must be true or false" }, { status: 400 });
    }
    if (!(await setTaskDone(ownerId, taskId, payload.done))) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not update the task" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { taskId } = await params;
    if (!(await deleteTask(ownerId, taskId))) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not remove the task" }, { status: 500 });
  }
}
