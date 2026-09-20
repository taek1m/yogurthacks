/**
 * What counts as an uploadable document, with no server-only imports, so the
 * upload controls in the browser and the reader on the server agree without
 * dragging the PDF and Gemini libraries into the client bundle.
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** A photographed agreement runs to a few pages; more than this is a PDF's job. */
export const MAX_PHOTOS = 6;

/** The picture formats Gemini can read. A phone camera produces one of these. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

/** The accept attribute for every upload control, so they all stay in step. */
export const UPLOAD_ACCEPT = `application/pdf,.pdf,${PHOTO_TYPES.join(",")},${PHOTO_EXTENSIONS.join(",")}`;

/** What a rejected upload should say, shared by the modal and the chat. */
export const UNSUPPORTED_UPLOAD_MESSAGE = "Upload a PDF, or a photo of the document.";

export function isPdfFile(file: { type: string; name: string }): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isPhotoFile(file: { type: string; name: string }): boolean {
  const name = file.name.toLowerCase();
  // Some browsers hand over an empty type for HEIC, so the name is the fallback.
  return PHOTO_TYPES.includes(file.type) || PHOTO_EXTENSIONS.some((suffix) => name.endsWith(suffix));
}

export function isSupportedUpload(file: { type: string; name: string }): boolean {
  return isPdfFile(file) || isPhotoFile(file);
}

/** The label a set of photos is saved under, since each has a camera file name. */
export function photoDocumentName(files: Array<{ name: string }>): string {
  const first = files[0].name.slice(0, 140);
  return files.length === 1 ? first : `${first} +${files.length - 1} more photos`;
}
