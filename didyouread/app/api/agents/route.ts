import { PDFParse } from "pdf-parse";
import { analyzePages, agentNameFor, classifyDocument, getStablePosition } from "@/lib/agent-utils";
import { countAgents, createAgent, listAgents } from "@/lib/agent-repository";
import { authErrorResponse, requireUserId } from "@/lib/auth";
import type { StoredDocumentAgent } from "@/types/agent";

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
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File)) return Response.json({ error: "A PDF document is required" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return Response.json({ error: "PDFs must be 5 MB or smaller" }, { status: 413 });
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Only PDF documents are supported" }, { status: 415 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
      return Response.json({ error: "This file does not appear to be a valid PDF" }, { status: 400 });
    }

    const parser = new PDFParse({ data });
    let result;
    try {
      result = await parser.getText();
    } finally {
      await parser.destroy();
    }
    if (result.total > 10) return Response.json({ error: "PDFs may contain at most 10 pages" }, { status: 400 });
    const extractedPages = result.pages.map((page) => ({ page: page.num, text: page.text.trim() }));
    if (!extractedPages.some((page) => page.text.length > 0)) {
      return Response.json({ error: "No readable text was found. Upload a text-based PDF." }, { status: 422 });
    }

    const allText = extractedPages.map((page) => page.text).join("\n");
    const documentType = classifyDocument(file.name, allText);
    const analysis = analyzePages(extractedPages);
    const now = new Date().toISOString();
    const index = await countAgents(ownerId);
    const id = crypto.randomUUID();
    const deadlineCount = analysis.deadlines.length;
    const attentionCount = analysis.concerns.length;
    const statusLabel = attentionCount > 0 ? "Needs attention" : deadlineCount > 0 ? `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"}` : "Analysis complete";
    const agent: StoredDocumentAgent = {
      id,
      ownerId,
      name: agentNameFor(documentType),
      documentName: file.name.slice(0, 180),
      sourceKind: "pdf",
      documentType,
      status: "ready",
      statusLabel,
      deadlineCount,
      attentionCount,
      position: getStablePosition(index),
      analysis,
      messages: [{ id: crypto.randomUUID(), role: "assistant", content: `I finished reading ${file.name}. Ask me about any term, deadline, or cost and I will point you back to the supporting text.`, createdAt: now }],
      extractedPages,
      createdAt: now,
      updatedAt: now,
    };
    return Response.json({ agent: await createAgent(agent) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Agent upload failed", error);
    return Response.json({ error: "The PDF could not be analyzed" }, { status: 500 });
  }
}
