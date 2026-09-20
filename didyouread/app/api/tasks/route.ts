import { addTasks, listTasks } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { buildTask } from "@/lib/tasks";

export async function GET() {
  try {
    const ownerId = await requireUserId();
    return Response.json({ tasks: await listTasks(ownerId) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not load your list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireUserId();
    const payload = (await request.json()) as {
      agentId?: unknown;
      title?: unknown;
      detail?: unknown;
      dueDate?: unknown;
    };
    if (typeof payload.agentId !== "string" || !payload.agentId) {
      return Response.json({ error: "An agent is required" }, { status: 400 });
    }
    const task = buildTask(payload);
    if (!task) return Response.json({ error: "A task title is required" }, { status: 400 });

    const saved = await addTasks(ownerId, payload.agentId, [task]);
    if (!saved) return Response.json({ error: "Agent not found" }, { status: 404 });
    return Response.json({ tasks: saved }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not save the task" }, { status: 500 });
  }
}
