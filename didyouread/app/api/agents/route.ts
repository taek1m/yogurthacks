import { analyzePages, agentNameFor, classifyDocument, getStablePosition } from "@/lib/agent-utils";
import { countAgents, createAgent, listAgents } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import { nameDocumentAgent } from "@/lib/gemini";
import { pdfErrorResponse, readPdfUpload } from "@/lib/pdf";
import type { DocumentType, StoredDocumentAgent } from "@/types/agent";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ownerId = await requireUserId();
    return Response.json({ agents: await listAgents(ownerId) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Could not load agents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireUserId();
    const { file, pages: extractedPages } = await readPdfUpload(await request.formData());

    const allText = extractedPages.map((page) => page.text).join("\n");
    const classified = classifyDocument(file.name, allText);
    let documentType: DocumentType = classified;
    let name = agentNameFor(classified);

    // Let Gemini read the title and body to name the agent. The local classifier
    // already produces a workable name, so a failure here must not fail the upload.
    if (process.env.GEMINI_API_KEY) {
      try {
        const profile = await nameDocumentAgent(file.name, allText);
        name = profile.name;
        // The keyword classifier is the more reliable of the two when it is sure.
        if (classified === "general") documentType = profile.documentType;
      } catch (error) {
        console.error("Gemini could not name this document; using the local name", error);
      }
    }

    const analysis = analyzePages(extractedPages);
    const now = new Date().toISOString();
    const index = await countAgents(ownerId);
    const deadlineCount = analysis.deadlines.length;
    const attentionCount = analysis.concerns.length;
    const statusLabel = attentionCount > 0 ? "Needs attention" : deadlineCount > 0 ? `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"}` : "Analysis complete";
    const documentName = file.name.slice(0, 180);
    const agent: StoredDocumentAgent = {
      id: crypto.randomUUID(),
      ownerId,
      name,
      documentName,
      documentNames: [documentName],
      sourceKind: "pdf",
      documentType,
      status: "ready",
      statusLabel,
      deadlineCount,
      attentionCount,
      position: getStablePosition(index),
      analysis,
      messages: [{ id: crypto.randomUUID(), role: "assistant", content: `I finished reading ${file.name}. Ask me about any term, deadline, or cost and I will point you back to the supporting text. You can also attach another PDF to this conversation at any time.`, createdAt: now }],
      extractedPages: extractedPages.map((page) => ({ ...page, source: documentName })),
      createdAt: now,
      updatedAt: now,
    };
    return Response.json({ agent: await createAgent(agent) }, { status: 201 });
  } catch (error) {
    const handled = authErrorResponse(error) ?? pdfErrorResponse(error);
    if (handled) return handled;
    console.error("Agent upload failed", error);
    return Response.json({ error: "The PDF could not be analyzed" }, { status: 500 });
  }
}
