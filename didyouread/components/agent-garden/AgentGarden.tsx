"use client";

import { Cloud, Sprout } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentObject } from "@/components/agent-garden/AgentObject";
import { AgentSidebar } from "@/components/agent-garden/AgentSidebar";
import { SPOTLIGHT_EVENT, takeSpotlightRequest } from "@/components/agent-garden/gardenEvents";
import { Cannon } from "@/components/agent-garden/Cannon";
import { LastAgentCutscene } from "@/components/agent-garden/LastAgentCutscene";
import { CreateAgentObject } from "@/components/agent-garden/CreateAgentObject";
import type { DocumentAgent, GardenPosition } from "@/types/agent";

export function AgentGarden({ agents: initialAgents }: { agents: DocumentAgent[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const gardenRef = useRef<HTMLDivElement>(null);
  const cannonRef = useRef<HTMLDivElement>(null);
  const [cannonArmed, setCannonArmed] = useState(false);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [blastKey, setBlastKey] = useState(0);
  // The send-off for the very last agent, and the state it leaves behind.
  const [abduction, setAbduction] = useState<{ agent: DocumentAgent; at: GardenPosition } | null>(null);
  const [cannonKicked, setCannonKicked] = useState(false);
  const empty = agents.length === 0 && !abduction;
  const lastOne = agents.length === 1;

  function beginAbduction(id: string, at: GardenPosition) {
    const agent = agents.find((item) => item.id === id);
    if (!agent) return;
    setAbduction({ agent, at });
  }

  /** The agent is off-screen: make the deletion real and clear the garden. */
  async function finishAbduction() {
    const taken = abduction?.agent;
    if (!taken) return;
    try {
      await removeAgent(taken.id);
    } catch {
      // The character is already gone from view; drop it locally either way.
      setAgents((current) => current.filter((item) => item.id !== taken.id));
    }
  }

  async function patchAgent(id: string, updates: { name?: string; position?: GardenPosition }) {
    const response = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = (await response.json()) as { agent?: DocumentAgent; error?: string };
    if (!response.ok || !result.agent) throw new Error(result.error || "Agent could not be updated");
    setAgents((current) => current.map((agent) => agent.id === id ? result.agent! : agent));
    window.dispatchEvent(new Event("agent-garden:changed"));
  }

  // A pick from the header search, made here or on the way back from another page.
  useEffect(() => {
    const claim = () => {
      const id = takeSpotlightRequest();
      if (id) setSpotlightId(id);
    };
    // A beat so the agents have settled into their positions first.
    const timer = window.setTimeout(claim, 350);
    window.addEventListener(SPOTLIGHT_EVENT, claim);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SPOTLIGHT_EVENT, claim);
    };
  }, []);

  // The spotlight is a moment, not a mode: it fades on its own.
  useEffect(() => {
    if (!spotlightId) return;
    const timer = window.setTimeout(() => setSpotlightId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [spotlightId]);

  async function removeAgent(id: string) {
    const response = await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      throw new Error(result.error || "Agent could not be removed");
    }
    setAgents((current) => current.filter((agent) => agent.id !== id));
    setSpotlightId((current) => (current === id ? null : current));
    window.dispatchEvent(new Event("agent-garden:changed"));
  }
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col md:flex-row">
      {!empty && (
        <AgentSidebar
          agents={agents}
          selectedId={spotlightId}
          onSelect={(id) => setSpotlightId(id)}
        />
      )}
      <section className="relative flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col overflow-hidden bg-[#dff1f7]" aria-labelledby="garden-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] overflow-hidden">
        <Cloud className="absolute left-[8%] top-12 text-white/80" size={54} fill="currentColor" strokeWidth={1} />
        <Cloud className="absolute right-[12%] top-20 text-white/70" size={72} fill="currentColor" strokeWidth={1} />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] items-end justify-between px-5 pb-5 pt-6 sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase text-[#386a4b]">Your workspace</p>
          <h1 id="garden-title" className="font-display text-3xl font-semibold text-[#173c28] sm:text-4xl">Agent Garden</h1>
        </div>
        {!empty && <p className="hidden text-sm font-medium text-[#3d6850] sm:block">{agents.length} agent{agents.length === 1 ? "" : "s"} growing</p>}
      </div>

      {/* isolate: raising one agent above the others must not lift it over the header. */}
      <div className="relative isolate flex flex-1 items-stretch">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[88%] rounded-t-[50%_12%] bg-[#7ebd70]" />
        <div className="pointer-events-none absolute inset-x-[-5%] bottom-0 h-[65%] rounded-t-[48%_18%] bg-[#5ca857]" />
        <div className="pointer-events-none absolute inset-x-[-5%] bottom-0 h-[35%] bg-[#438b49]" />

        {empty ? (
          <div className="relative z-10 mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
            <span className="mb-5 grid size-20 place-items-center rounded-full bg-[#fffbea] text-[#32754a] shadow-lg ring-4 ring-white/40"><Sprout size={40} /></span>
            <h2 className="font-display text-3xl font-semibold text-[#143923] sm:text-4xl">Your document agents live here</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#214b31] sm:text-base">Create an agent from a topic, or upload a PDF for document-specific analysis. Every conversation is saved to its own garden object.</p>
            <div className="mt-7"><CreateAgentObject /></div>
          </div>
        ) : null}
        {(agents.length > 0 || abduction) && (
          <div ref={gardenRef} className="relative z-10 mx-auto grid w-full max-w-[1500px] grid-cols-2 content-start gap-x-4 gap-y-10 px-5 pb-16 pt-16 sm:grid-cols-3 sm:px-8 md:block md:min-h-[650px] md:pt-0">
            {agents.filter((agent) => agent.id !== abduction?.agent.id).map((agent, index) => (
              <AgentObject
                key={agent.id}
                agent={agent}
                index={index}
                spotlight={agent.id === spotlightId}
                gardenRef={gardenRef}
                cannonRef={cannonRef}
                onCannonArm={setCannonArmed}
                onCannonFire={() => setBlastKey((value) => value + 1)}
                onSavePosition={(id, position) => patchAgent(id, { position })}
                onRename={(id, name) => patchAgent(id, { name })}
                onRemove={removeAgent}
                onAbduct={lastOne ? beginAbduction : undefined}
              />
            ))}
            <div ref={cannonRef} className="pointer-events-none absolute bottom-6 left-4 z-20 hidden md:block">
              <Cannon armed={cannonArmed} blastKey={blastKey} kicked={cannonKicked} />
            </div>
            {abduction && (
              <LastAgentCutscene
                victim={abduction.agent}
                victimAt={abduction.at}
                onHauled={finishAbduction}
                onCannonKicked={() => setCannonKicked(true)}
                onFinished={() => { setAbduction(null); setCannonKicked(false); }}
              />
            )}
          </div>
        )}
      </div>
      </section>
    </div>
  );
}
