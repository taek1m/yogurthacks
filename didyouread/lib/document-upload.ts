import { NO_TEXT_IN_PHOTO, transcribeDocumentPhoto } from "@/lib/gemini";
import { PdfError, readPdfUpload } from "@/lib/pdf";
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  UNSUPPORTED_UPLOAD_MESSAGE,
  isPdfFile,
  isPhotoFile,
  photoDocumentName,
} from "@/lib/upload-kinds";
import type { DocumentPage } from "@/types/agent";

export interface ReadDocument {
  pages: DocumentPage[];
  /** What to call this document in the garden and the marked-up view. */
  documentName: string;
  /** Photos and PDFs are named differently, so they collide differently too. */
  kind: "pdf" | "photos";
}

/**
 * Makes a document name that is not taken yet. A phone camera hands back the
 * same "image.jpg" for every shot, so a name already in use means another
 * photo, not the same one arriving twice.
 */
export function unusedDocumentName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  for (let attempt = 2; attempt < 1000; attempt += 1) {
    const candidate = `${stem} (${attempt})${extension}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${stem} (${Date.now()})${extension}`;
}

/** Transcribes each photographed page into the same shape a PDF produces. */
async function readPhotoUpload(files: File[]): Promise<ReadDocument> {
  if (files.length > MAX_PHOTOS) {
    throw new PdfError(`Upload at most ${MAX_PHOTOS} photos at a time`, 400);
  }
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) throw new PdfError("Photos must be 8 MB or smaller", 413);
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new PdfError("Reading a photo needs the agent. Add GEMINI_API_KEY, or upload a PDF.", 503);
  }

  const pages: DocumentPage[] = [];
  // One request per photo, run in order: a burst of parallel calls is the
  // quickest way to trip the free tier's rate limit.
  for (const [index, file] of files.entries()) {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = PHOTO_TYPES.includes(file.type) ? file.type : "image/jpeg";
    let text: string;
    try {
      text = await transcribeDocumentPhoto(data, mimeType);
    } catch (error) {
      // Quota and key failures have their own wording; let those through.
      if (error instanceof Error && error.message.startsWith("GEMINI_")) throw error;
      throw new PdfError("That photo could not be read. Please try again.", 502);
    }
    if (text !== NO_TEXT_IN_PHOTO) pages.push({ page: index + 1, text });
  }

  if (!pages.some((page) => page.text.length > 0)) {
    throw new PdfError(
      files.length === 1
        ? "No text could be read in that photo. Retake it straight on, in good light, with the whole page in frame."
        : "No text could be read in those photos. Retake them straight on, in good light, with the whole page in frame.",
      422,
    );
  }
  return { pages, documentName: photoDocumentName(files), kind: "photos" };
}

/**
 * Reads whatever the user uploaded: a single PDF, or up to MAX_PHOTOS pictures
 * of a paper document taken with a phone. Photos are transcribed by Gemini, so
 * everything downstream — naming, analysis, highlights — sees plain page text
 * and never has to care which one arrived.
 */
export async function readDocumentUpload(form: FormData, field = "document"): Promise<ReadDocument> {
  const files = form.getAll(field).filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) throw new PdfError("A PDF or a photo of the document is required", 400);

  if (files.some(isPdfFile)) {
    if (files.length > 1) throw new PdfError("Upload one PDF on its own, or photos together", 400);
    const { file, pages } = await readPdfUpload(form, field);
    return { pages, documentName: file.name.slice(0, 180), kind: "pdf" };
  }

  if (!files.every(isPhotoFile)) throw new PdfError(UNSUPPORTED_UPLOAD_MESSAGE, 415);
  return readPhotoUpload(files);
}
