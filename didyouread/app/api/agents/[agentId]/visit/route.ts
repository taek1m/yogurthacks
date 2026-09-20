import { recordAgentVisit } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";

/** Marks an agent as just visited, so the search bar can offer it again. */
export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    await recordAgentVisit(ownerId, agentId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      Response.json({ error: "Could not record the visit" }, { status: 500 })
    );
  }
}
