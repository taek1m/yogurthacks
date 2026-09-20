import { PDFParse } from "pdf-parse";
import type { DocumentPage } from "@/types/agent";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;

/** A rejection the caller should report to the user verbatim, with its status. */
export class PdfError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PdfError";
    this.status = status;
  }
}

/**
 * Validates and extracts the text of an uploaded PDF. Shared by agent creation
 * and by adding a document to an agent that already exists.
 */
export async function readPdfUpload(
  form: FormData,
  field = "document",
): Promise<{ file: File; pages: DocumentPage[] }> {
  const file = form.get(field);
  if (!(file instanceof File)) throw new PdfError("A PDF document is required", 400);
  if (file.size > MAX_PDF_BYTES) throw new PdfError("PDFs must be 5 MB or smaller", 413);
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new PdfError("Only PDF documents are supported", 415);
  }

  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
    throw new PdfError("This file does not appear to be a valid PDF", 400);
  }

  const parser = new PDFParse({ data });
  let result;
  try {
    result = await parser.getText();
  } finally {
    await parser.destroy();
  }

  if (result.total > MAX_PDF_PAGES) {
    throw new PdfError(`PDFs may contain at most ${MAX_PDF_PAGES} pages`, 400);
  }
  const pages = result.pages.map((page) => ({ page: page.num, text: page.text.trim() }));
  if (!pages.some((page) => page.text.length > 0)) {
    throw new PdfError("No readable text was found. Upload a text-based PDF.", 422);
  }
  return { file, pages };
}

export function pdfErrorResponse(error: unknown): Response | null {
  if (!(error instanceof PdfError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}
