import { countAgents, createAgent } from "@/lib/agent-repository";
import { classifyDocument, getStablePosition } from "@/lib/agent-utils";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { createTopicAgentProfile, geminiErrorResponse } from "@/lib/gemini";
import type { Finding, StoredDocumentAgent } from "@/types/agent";

export async function POST(request: Request) {
  try {
    const ownerId = await requireUserId();
    const payload = (await request.json()) as { topic?: unknown };
    const topic = typeof payload.topic === "string" ? payload.topic.trim().slice(0, 160) : "";
    if (topic.length < 3) {
      return Response.json({ error: "Enter a topic with at least 3 characters" }, { status: 400 });
    }

    const profile = await createTopicAgentProfile(topic);
    const knownType = classifyDocument(topic, topic);
    const documentType = knownType === "general" ? profile.documentType : knownType;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const index = await countAgents(ownerId);
    const suggestedQuestions: Finding[] = profile.suggestedQuestions.map((question) => ({
      id: `question-${crypto.randomUUID()}`,
      title: question,
      detail: "Ask this in the chat to begin exploring the topic.",
      quote: `Topic provided by user: ${topic}`,
      page: null,
    }));
    const agent: StoredDocumentAgent = {
      id,
      ownerId,
      name: profile.name,
      documentName: `Topic: ${topic}`,
      sourceKind: "topic",
      topic,
      documentType,
      status: "ready",
      statusLabel: "Ready to chat",
      deadlineCount: 0,
      attentionCount: 0,
      position: getStablePosition(index),
      analysis: {
        summary: profile.summary,
        favorableTerms: [],
        concerns: [],
        deadlines: [],
        financialDetails: [],
        suggestedQuestions,
      },
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: profile.welcomeMessage,
          createdAt: now,
        },
      ],
      extractedPages: [{ page: 1, text: `User-created topic: ${topic}` }],
      createdAt: now,
      updatedAt: now,
    };

    return Response.json({ agent: await createAgent(agent) }, { status: 201 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      geminiErrorResponse(error) ??
      Response.json({ error: "Could not create this agent" }, { status: 500 })
    );
  }
}
