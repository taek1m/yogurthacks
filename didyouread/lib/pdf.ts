import { extractText, getDocumentProxy } from "unpdf";
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
 *
 * Uses unpdf instead of pdf-parse: pdf-parse wraps pdfjs-dist in a way that
 * references browser-only globals (DOMMatrix) at import time, which crashes
 * on Vercel's serverless runtime even though it works locally. unpdf ships
 * a serverless-safe build of PDF.js with zero native dependencies.
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

  let totalPages: number;
  let pageTexts: string[];
  try {
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: false });
    totalPages = result.totalPages;
    // mergePages: false returns string[], one entry per page
    pageTexts = Array.isArray(result.text) ? result.text : [result.text];
  } catch (error) {
    throw new PdfError("Could not read this PDF. It may be corrupted or encrypted.", 422);
  }

  if (totalPages > MAX_PDF_PAGES) {
    throw new PdfError(`PDFs may contain at most ${MAX_PDF_PAGES} pages`, 400);
  }

  const pages: DocumentPage[] = pageTexts.map((text, index) => ({
    page: index + 1,
    text: text.trim(),
  }));

  if (!pages.some((page) => page.text.length > 0)) {
    throw new PdfError("No readable text was found. Upload a text-based PDF.", 422);
  }
  return { file, pages };
}

export function pdfErrorResponse(error: unknown): Response | null {
  if (!(error instanceof PdfError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}