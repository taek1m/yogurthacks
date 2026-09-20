import { describe, expect, it } from "vitest";
import { createAgent, recentAgents, recordAgentVisit } from "@/lib/agent-repository";
import type { StoredDocumentAgent } from "@/types/agent";

function record(ownerId: string, id: string, name: string): StoredDocumentAgent {
  return {
    id, ownerId, name, documentName: `${name}.pdf`, documentType: "general", status: "ready", statusLabel: "Analysis complete",
    deadlineCount: 0, attentionCount: 0, analysis: { summary: "", favorableTerms: [], concerns: [], deadlines: [], financialDetails: [], suggestedQuestions: [] },
    messages: [], extractedPages: [{ page: 1, text: name }], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("recently visited agents", () => {
  it("lists the last visited first and leaves unvisited agents out", async () => {
    const suffix = crypto.randomUUID();
    const ownerId = `owner-recent-${suffix}`;
    for (const name of ["first", "second", "third", "never"]) {
      await createAgent(record(ownerId, `${name}-${suffix}`, `${name}-${suffix}`));
    }

    // Visits are stamped to the millisecond, so space them as real opens are.
    for (const id of [`first-${suffix}`, `second-${suffix}`, `third-${suffix}`, `first-${suffix}`]) {
      await recordAgentVisit(ownerId, id);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    // The last line of the loop revisited "first", moving it back to the top.
    const recent = await recentAgents(ownerId, 3);
    expect(recent.map((agent) => agent.agentId)).toEqual([
      `first-${suffix}`,
      `third-${suffix}`,
      `second-${suffix}`,
    ]);
  });

  it("never offers another owner's agents", async () => {
    const suffix = crypto.randomUUID();
    const ownerId = `owner-mine-${suffix}`;
    const otherOwner = `owner-theirs-${suffix}`;
    await createAgent(record(otherOwner, `theirs-${suffix}`, `theirs-${suffix}`));

    await recordAgentVisit(otherOwner, `theirs-${suffix}`);
    // A visit recorded under the wrong owner must not touch the record either.
    await recordAgentVisit(ownerId, `theirs-${suffix}`);

    expect(await recentAgents(ownerId, 3)).toEqual([]);
  });
});
