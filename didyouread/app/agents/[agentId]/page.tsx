import { notFound } from "next/navigation";
import { AgentChat } from "@/components/agents/AgentChat";
import { AnalysisPanel } from "@/components/agents/AnalysisPanel";
import { getAgent } from "@/lib/agent-repository";
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
  const agent = await getAgent(userId, agentId);
  if (!agent) notFound();
  const highlightedMessage = typeof query.message === "string" ? query.message : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
      <AgentChat agent={agent} highlightedMessage={highlightedMessage} />
      <AnalysisPanel analysis={agent.analysis} documentName={agent.documentName} sourceKind={agent.sourceKind} />
    </div>
  );
}
