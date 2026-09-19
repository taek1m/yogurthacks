import { notFound } from "next/navigation";
import { AgentChat } from "@/components/agents/AgentChat";
import { DocumentHighlights } from "@/components/agents/DocumentHighlights";
import { getAgentWithPages } from "@/lib/agent-repository";
import { buildHighlightedDocument } from "@/lib/document-highlights";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ agentId }, query, userId] = await Promise.all([params, searchParams, getCurrentUserId()]);
  if (!userId) notFound();
  const record = await getAgentWithPages(userId, agentId);
  if (!record) notFound();
  const { agent, pages } = record;
  const highlightedMessage = typeof query.message === "string" ? query.message : undefined;
  // Topic agents have no source document, so the chat takes the full width.
  const highlighted =
    agent.sourceKind !== "topic" && pages.some((page) => page.text.length > 0)
      ? buildHighlightedDocument(pages, agent.analysis)
      : null;

  return (
    <div
      className={`mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 ${highlighted ? "lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]" : ""}`}
    >
      <AgentChat agent={agent} highlightedMessage={highlightedMessage} />
      {highlighted && <DocumentHighlights document={highlighted} documentName={agent.documentName} />}
    </div>
  );
}
