import { appendMessages, getStoredAgent } from "@/lib/agent-repository";
import { buildGroundedAnswer } from "@/lib/agent-utils";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { geminiErrorResponse, generateAgentReply } from "@/lib/gemini";
import type { AgentMessage } from "@/types/agent";

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const payload = (await request.json()) as { content?: unknown };
    const content = typeof payload.content === "string" ? payload.content.trim().slice(0, 2000) : "";
    if (!content) return Response.json({ error: "A question is required" }, { status: 400 });
    const agent = await getStoredAgent(ownerId, agentId);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });

    let answer: string;
    if (process.env.GEMINI_API_KEY) {
      answer = await generateAgentReply(agent, content);
    } else if (agent.sourceKind === "topic") {
      throw new Error("GEMINI_NOT_CONFIGURED");
    } else {
      answer = buildGroundedAnswer(content, agent.extractedPages);
    }

    const now = new Date().toISOString();
    const messages: AgentMessage[] = [
      { id: crypto.randomUUID(), role: "user", content, createdAt: now },
      { id: crypto.randomUUID(), role: "assistant", content: answer, createdAt: new Date().toISOString() },
    ];
    await appendMessages(ownerId, agentId, messages);
    return Response.json({ messages });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      geminiErrorResponse(error) ??
      Response.json({ error: "Could not save this conversation" }, { status: 500 })
    );
  }
}
