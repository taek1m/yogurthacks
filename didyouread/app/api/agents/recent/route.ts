import { recentAgents } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";

/** Feeds the shortlist the search bar shows before anything has been typed. */
export const RECENT_AGENT_LIMIT = 3;

export async function GET() {
  try {
    const ownerId = await requireUserId();
    return Response.json({ agents: await recentAgents(ownerId, RECENT_AGENT_LIMIT) });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      Response.json({ error: "Could not load recent agents" }, { status: 500 })
    );
  }
}
