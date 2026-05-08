import pdf from "pdf-parse";

export interface LoadedDocumentText {
  text: string;
  mimeType: string;
}

export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/([a-z0-9,.;:)])\n([a-z0-9(])/gi, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts plain text from an uploaded source document.
 * Phase 1 supports text-like files and PDFs without OCR.
 */
export async function extractTextFromFile(file: File): Promise<LoadedDocumentText> {
  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type || "application/octet-stream";

  if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdf(Buffer.from(arrayBuffer));
    return {
      text: cleanExtractedText(parsed.text),
      mimeType
    };
  }

  return {
    text: cleanExtractedText(Buffer.from(arrayBuffer).toString("utf8")),
    mimeType
  };
}
