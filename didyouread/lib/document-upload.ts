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
    throw new PdfError("Reading a photo needs Gemini. Add GEMINI_API_KEY, or upload a PDF.", 503);
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
  return { pages, documentName: photoDocumentName(files) };
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
    return { pages, documentName: file.name.slice(0, 180) };
  }

  if (!files.every(isPhotoFile)) throw new PdfError(UNSUPPORTED_UPLOAD_MESSAGE, 415);
  return readPhotoUpload(files);
}
