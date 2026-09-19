import { describe, expect, it } from "vitest";
import { createAgent, deleteAgent, getAgent, listAgents, searchAgents, updateAgent } from "@/lib/agent-repository";
import type { StoredDocumentAgent } from "@/types/agent";

function record(ownerId: string, id: string, secret: string): StoredDocumentAgent {
  return {
    id, ownerId, name: `${secret} agent`, documentName: `${secret}.pdf`, documentType: "general", status: "ready", statusLabel: "Analysis complete",
    deadlineCount: 0, attentionCount: 0, analysis: { summary: "", favorableTerms: [], concerns: [], deadlines: [], financialDetails: [], suggestedQuestions: [] },
    messages: [{ id: `${id}-message`, role: "user", content: `${secret} conversation`, createdAt: "2026-01-01T00:00:00.000Z" }],
    extractedPages: [{ page: 1, text: secret }], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("repository ownership", () => {
  it("never returns another owner's records or messages", async () => {
    const suffix = crypto.randomUUID();
    const firstOwner = `owner-a-${suffix}`;
    const secondOwner = `owner-b-${suffix}`;
    await createAgent(record(firstOwner, `a-${suffix}`, `orchid-${suffix}`));
    await createAgent(record(secondOwner, `b-${suffix}`, `private-${suffix}`));

    expect(await listAgents(firstOwner)).toHaveLength(1);
    expect(await getAgent(firstOwner, `b-${suffix}`)).toBeNull();
    const results = await searchAgents(firstOwner, `private-${suffix}`);
    expect(results).toEqual({ agents: [], messages: [] });
  });

  it("scopes edits and removal to the owner", async () => {
    const suffix = crypto.randomUUID();
    const ownerId = `owner-edit-${suffix}`;
    const otherOwner = `owner-other-${suffix}`;
    const id = `editable-${suffix}`;
    await createAgent(record(ownerId, id, `editable-${suffix}`));

    expect(await updateAgent(otherOwner, id, { name: "Wrong owner" })).toBeNull();
    expect(await deleteAgent(otherOwner, id)).toBe(false);
    const updated = await updateAgent(ownerId, id, {
      name: "Renamed agent",
      position: { xPercent: 42, yPercent: 63 },
    });
    expect(updated?.name).toBe("Renamed agent");
    expect(updated?.position).toEqual({ xPercent: 42, yPercent: 63 });
    expect(await deleteAgent(ownerId, id)).toBe(true);
    expect(await getAgent(ownerId, id)).toBeNull();
  });
});
