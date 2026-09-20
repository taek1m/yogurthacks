import { appendMessages, getStoredAgent, saveHighlightEdits } from "@/lib/agent-repository";
import { buildGroundedAnswer } from "@/lib/agent-utils";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { geminiErrorResponse, generateAgentReply } from "@/lib/gemini";
import { applyHighlightCommands, missingQuoteNote } from "@/lib/highlight-commands";
import { createTodos } from "@/lib/todo-repository";
import type { AgentMessage, TodoItem } from "@/types/agent";

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
    let added: TodoItem[] = [];
    // Says whether the marked-up panel has to be repainted after this reply.
    let highlightsChanged = false;
    if (process.env.GEMINI_API_KEY) {
      const result = await generateAgentReply(agent, content);
      answer = result.reply;

      // The reader can ask for the marked-up document to change in plain words.
      if (result.highlights.length > 0 && agent.sourceKind !== "topic") {
        const edits = applyHighlightCommands(agent, result.highlights);
        if (edits.applied > 0) {
          highlightsChanged = Boolean(await saveHighlightEdits(ownerId, agentId, edits));
        }
        answer += missingQuoteNote(edits.missing);
      }

      // The agent can put things on the reader's list when they ask it to.
      const now = new Date().toISOString();
      added = await createTodos(
        result.todos.map((todo) => ({
          id: crypto.randomUUID(),
          ownerId,
          title: todo.title,
          detail: todo.detail,
          dueDate: todo.dueDate,
          agentId: agent.id,
          agentName: agent.name,
          done: false,
          createdAt: now,
        })),
      );
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
    return Response.json({ messages, todos: added, highlightsChanged });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      geminiErrorResponse(error) ??
      Response.json({ error: "Could not save this conversation" }, { status: 500 })
    );
  }
}
