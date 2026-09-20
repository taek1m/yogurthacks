// @vitest-environment node
// jsdom's File has no arrayBuffer(), which is how a photo reaches Gemini.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transcribe = vi.fn();
const readPdf = vi.fn();

vi.mock("@/lib/gemini", () => ({
  NO_TEXT_IN_PHOTO: "NO_TEXT_FOUND",
  transcribeDocumentPhoto: (...args: unknown[]) => transcribe(...args),
}));
vi.mock("@/lib/pdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf")>("@/lib/pdf");
  return { ...actual, readPdfUpload: (...args: unknown[]) => readPdf(...args) };
});

const { readDocumentUpload } = await import("@/lib/document-upload");
const { PdfError } = await import("@/lib/pdf");

function photo(name: string, type = "image/jpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function form(...files: File[]) {
  const body = new FormData();
  for (const file of files) body.append("document", file);
  return body;
}

describe("reading an uploaded document", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    transcribe.mockReset();
    readPdf.mockReset();
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("turns each photo into its own page, in the order they were taken", async () => {
    transcribe.mockResolvedValueOnce("Page one of the car agreement");
    transcribe.mockResolvedValueOnce("Page two, the payment schedule");

    const result = await readDocumentUpload(form(photo("IMG_01.jpg"), photo("IMG_02.jpg")));

    expect(result.pages).toEqual([
      { page: 1, text: "Page one of the car agreement" },
      { page: 2, text: "Page two, the payment schedule" },
    ]);
    expect(result.documentName).toBe("IMG_01.jpg +1 more photos");
  });

  it("reads a HEIC photo from an iPhone, which arrives with no media type", async () => {
    transcribe.mockResolvedValueOnce("Dealer contract");

    const result = await readDocumentUpload(form(photo("IMG_9001.HEIC", "")));

    expect(result.pages[0].text).toBe("Dealer contract");
    // An unknown type must still reach Gemini as something it accepts.
    expect(transcribe).toHaveBeenCalledWith(expect.any(String), "image/jpeg");
  });

  it("asks for a better photo when nothing could be read", async () => {
    transcribe.mockResolvedValueOnce("NO_TEXT_FOUND");

    await expect(readDocumentUpload(form(photo("blurry.jpg")))).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("Retake it"),
    });
  });

  it("still sends a PDF to the PDF reader", async () => {
    readPdf.mockResolvedValue({
      file: { name: "lease.pdf" },
      pages: [{ page: 1, text: "Rent is due on the first." }],
    });

    const result = await readDocumentUpload(form(new File(["x"], "lease.pdf", { type: "application/pdf" })));

    expect(result.documentName).toBe("lease.pdf");
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("rejects a file that is neither a PDF nor a photo", async () => {
    await expect(
      readDocumentUpload(form(new File(["x"], "notes.txt", { type: "text/plain" }))),
    ).rejects.toBeInstanceOf(PdfError);
  });

  it("says so plainly when photos arrive without a Gemini key to read them", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(readDocumentUpload(form(photo("IMG_01.jpg")))).rejects.toMatchObject({
      status: 503,
    });
  });
});
