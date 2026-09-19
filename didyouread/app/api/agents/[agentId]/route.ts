import { deleteAgent, updateAgent } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import type { GardenPosition } from "@/types/agent";

function validPosition(value: unknown): value is GardenPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Partial<GardenPosition>;
  return (
    typeof position.xPercent === "number" &&
    Number.isFinite(position.xPercent) &&
    position.xPercent >= 5 &&
    position.xPercent <= 95 &&
    typeof position.yPercent === "number" &&
    Number.isFinite(position.yPercent) &&
    position.yPercent >= 10 &&
    position.yPercent <= 92
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const payload = (await request.json()) as { name?: unknown; position?: unknown };
    const updates: { name?: string; position?: GardenPosition } = {};

    if (payload.name !== undefined) {
      if (typeof payload.name !== "string" || payload.name.trim().length < 2) {
        return Response.json({ error: "Agent names need at least 2 characters" }, { status: 400 });
      }
      updates.name = payload.name.trim().slice(0, 60);
    }
    if (payload.position !== undefined) {
      if (!validPosition(payload.position)) {
        return Response.json({ error: "Invalid garden position" }, { status: 400 });
      }
      updates.position = payload.position;
    }
    if (!updates.name && !updates.position) {
      return Response.json({ error: "No supported changes were provided" }, { status: 400 });
    }

    const agent = await updateAgent(ownerId, agentId, updates);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    return Response.json({ agent });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not update agent" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    if (!(await deleteAgent(ownerId, agentId))) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not remove agent" }, { status: 500 });
  }
}
