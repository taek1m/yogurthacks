import { getStoredAgent, saveReanalysis } from "@/lib/agent-repository";
import { analyzePages } from "@/lib/agent-utils";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { geminiErrorResponse, reviewDocumentHighlights } from "@/lib/gemini";
import { applyHighlightCommands } from "@/lib/highlight-commands";

export const runtime = "nodejs";

/**
 * Reads a document again when the reader thinks its highlights are wrong. The
 * rule-based analysis is recomputed over every page, and Gemini reads the one
 * document they pointed at to mark what the word lists missed.
 *
 * Reader edits survive: they are keyed by the sentence they quote, not by any
 * id the analysis hands out.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const agent = await getStoredAgent(ownerId, agentId);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    if (agent.sourceKind === "topic" || agent.extractedPages.length === 0) {
      return Response.json({ error: "This agent has no document to re-read" }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as { source?: unknown };
    const source = typeof body.source === "string" ? body.source : undefined;
    const chosen = source
      ? agent.extractedPages.filter((page) => (page.source ?? agent.documentName) === source)
      : agent.extractedPages;
    if (chosen.length === 0) return Response.json({ error: "That document is not on this agent" }, { status: 404 });

    // The rules run over everything, so a document added under older limits is
    // brought up to date at the same time.
    const analysis = analyzePages(agent.extractedPages);
    const deadlineCount = analysis.deadlines.length;
    const attentionCount = analysis.concerns.length;

    let added = 0;
    let readerHighlights = agent.readerHighlights ?? [];
    let aiError: string | undefined;
    if (process.env.GEMINI_API_KEY) {
      try {
        const marked = [
          ...analysis.concerns,
          ...analysis.deadlines,
          ...analysis.financialDetails,
          ...analysis.favorableTerms,
        ]
          .filter((finding) => chosen.some((page) => page.page === finding.page))
          .map((finding) => finding.quote);
        const commands = await reviewDocumentHighlights(chosen, marked);
        const edits = applyHighlightCommands({ ...agent, analysis }, commands);
        readerHighlights = edits.readerHighlights;
        added = edits.readerHighlights.length - (agent.readerHighlights?.length ?? 0);
      } catch (error) {
        // A failed re-read still leaves the refreshed analysis in place.
        aiError = error instanceof Error ? error.message : "GEMINI_UNAVAILABLE";
      }
    } else {
      aiError = "GEMINI_NOT_CONFIGURED";
    }

    const updated = await saveReanalysis(ownerId, agentId, {
      analysis,
      readerHighlights,
      deadlineCount,
      attentionCount,
      statusLabel:
        attentionCount > 0
          ? "Needs attention"
          : deadlineCount > 0
            ? `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"}`
            : "Analysis complete",
    });
    if (!updated) return Response.json({ error: "Agent not found" }, { status: 404 });

    return Response.json({
      added,
      marks: analysis.concerns.length + analysis.deadlines.length + analysis.financialDetails.length,
      aiError,
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      geminiErrorResponse(error) ??
      Response.json({ error: "The document could not be read again" }, { status: 500 })
    );
  }
}
