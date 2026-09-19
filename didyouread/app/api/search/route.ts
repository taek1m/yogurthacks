import { searchAgents } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const ownerId = await requireUserId();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return Response.json(await searchAgents(ownerId, query));
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Search failed" }, { status: 500 });
  }
}
