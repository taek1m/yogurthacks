import { setHighlightOverride } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import type { FindingSeverity, HighlightKind, HighlightOverride } from "@/types/agent";

const KINDS: HighlightKind[] = ["concern", "deadline", "financial", "favorable"];
const SEVERITIES: FindingSeverity[] = ["red_flag", "important", "info"];

/** Re-colours or removes one highlight the reader disagrees with. */
export async function PATCH(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const payload = (await request.json()) as {
      key?: unknown;
      kind?: unknown;
      severity?: unknown;
      removed?: unknown;
      reset?: unknown;
    };

    const key = typeof payload.key === "string" ? payload.key.trim().slice(0, 120) : "";
    if (!key) return Response.json({ error: "A highlight key is required" }, { status: 400 });

    let override: HighlightOverride | null = null;
    if (payload.reset !== true) {
      if (payload.removed === true) {
        override = { removed: true };
      } else {
        if (!KINDS.includes(payload.kind as HighlightKind)) {
          return Response.json({ error: "Unknown highlight category" }, { status: 400 });
        }
        override = {
          kind: payload.kind as HighlightKind,
          severity: SEVERITIES.includes(payload.severity as FindingSeverity)
            ? (payload.severity as FindingSeverity)
            : "important",
        };
      }
    }

    const agent = await setHighlightOverride(ownerId, agentId, key, override);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    return Response.json({ highlightOverrides: agent.highlightOverrides ?? {} });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not update the highlight" }, { status: 500 });
  }
}
