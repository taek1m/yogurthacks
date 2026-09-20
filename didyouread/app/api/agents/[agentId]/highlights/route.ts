import { clearHighlightOverrides, setHighlightOverride, setPageHidden } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import type { FindingSeverity, HighlightKind, HighlightOverride } from "@/types/agent";

const KINDS: HighlightKind[] = ["concern", "deadline", "financial", "favorable"];
const SEVERITIES: FindingSeverity[] = ["red_flag", "important", "info"];

/** Re-colours or removes one highlight, or deletes a whole page from the view. */
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
      page?: unknown;
      hidden?: unknown;
    };

    // A page is deleted from the marked-up view by its number, not by a key.
    if (payload.page !== undefined) {
      const page = payload.page;
      if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
        return Response.json({ error: "A page number is required" }, { status: 400 });
      }
      const updated = await setPageHidden(ownerId, agentId, page, payload.hidden !== false);
      if (!updated) return Response.json({ error: "Agent not found" }, { status: 404 });
      return Response.json({ hiddenPages: updated.hiddenPages ?? [] });
    }

    // Keys are hashes from highlightKey; anything else would be an unsafe
    // MongoDB field name.
    const key = typeof payload.key === "string" ? payload.key.trim() : "";
    if (!/^h[0-9a-f]{16}$/.test(key)) {
      return Response.json({ error: "A highlight key is required" }, { status: 400 });
    }

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
    return authErrorResponse(error) ?? Response.json({ error: "Could not update the marked-up view" }, { status: 500 });
  }
}

/** Puts every highlight and deleted page back the way the analysis first drew it. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const agent = await clearHighlightOverrides(ownerId, agentId);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    return Response.json({ highlightOverrides: {}, hiddenPages: [] });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not restore the highlights" }, { status: 500 });
  }
}
