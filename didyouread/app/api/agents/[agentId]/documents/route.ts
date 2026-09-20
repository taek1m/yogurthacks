import { analyzePages } from "@/lib/agent-utils";
import { addAgentDocument, getStoredAgent } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { geminiErrorResponse } from "@/lib/gemini";
import { readDocumentUpload, unusedDocumentName } from "@/lib/document-upload";
import { pdfErrorResponse } from "@/lib/pdf";
import type { AgentMessage, DocumentPage } from "@/types/agent";

export const runtime = "nodejs";

/** Adds another PDF, or a photographed page, to an agent that already exists. */
export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const ownerId = await requireUserId();
    const { agentId } = await params;
    const agent = await getStoredAgent(ownerId, agentId);
    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });

    const { pages, documentName: uploadedName, kind } = await readDocumentUpload(await request.formData());
    // A topic agent holds no real document, only a placeholder page. Its first
    // PDF turns it into a document agent so the marked-up view can appear.
    const wasTopic = agent.sourceKind === "topic";
    const existingNames = wasTopic ? [] : (agent.documentNames ?? [agent.documentName]);
    // The same PDF twice is a mistake worth reporting. The same photo name is
    // not: every shot off a phone camera arrives called the same thing.
    if (kind === "pdf" && existingNames.includes(uploadedName)) {
      return Response.json({ error: `${uploadedName} is already attached to this agent` }, { status: 409 });
    }
    const documentName = unusedDocumentName(uploadedName, existingNames);

    // Older agents stored pages without a source; label them before merging so
    // every page in the marked-up view says which file it came from.
    const existingPages: DocumentPage[] = wasTopic
      ? []
      : agent.extractedPages.map((page) => ({
          ...page,
          source: page.source ?? agent.documentName,
        }));
    // Page numbers continue past the pages already held, so they stay unique.
    const offset = existingPages.reduce((highest, page) => Math.max(highest, page.page), 0);
    const extractedPages = [
      ...existingPages,
      ...pages.map((page) => ({ page: offset + page.page, text: page.text, source: documentName })),
    ];

    const analysis = analyzePages(extractedPages);
    const deadlineCount = analysis.deadlines.length;
    const attentionCount = analysis.concerns.length;
    const message: AgentMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: wasTopic
        ? `I read ${documentName}. I now answer from that document, and the marked-up view on the right shows what stood out.`
        : `I read ${documentName} as well. I now answer using ${existingNames.length + 1} documents, and the marked-up view covers all of them.`,
      createdAt: new Date().toISOString(),
    };

    const updated = await addAgentDocument(ownerId, agentId, {
      ...(wasTopic ? { sourceKind: "pdf" as const, documentName } : {}),
      documentNames: [...existingNames, documentName],
      extractedPages,
      analysis,
      deadlineCount,
      attentionCount,
      statusLabel:
        attentionCount > 0
          ? "Needs attention"
          : deadlineCount > 0
            ? `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"}`
            : "Analysis complete",
      message,
    });
    if (!updated) return Response.json({ error: "Agent not found" }, { status: 404 });
    return Response.json({ agent: updated, message }, { status: 201 });
  } catch (error) {
    const handled = authErrorResponse(error) ?? pdfErrorResponse(error) ?? geminiErrorResponse(error);
    if (handled) return handled;
    console.error("Adding a document failed", error);
    return Response.json({ error: "The document could not be analyzed" }, { status: 500 });
  }
}
