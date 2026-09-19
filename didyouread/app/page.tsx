import { AgentGarden } from "@/components/agent-garden/AgentGarden";
import { listAgents } from "@/lib/agent-repository";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await getCurrentUserId();
  const agents = userId ? await listAgents(userId) : [];
  return <AgentGarden agents={agents} />;
}
