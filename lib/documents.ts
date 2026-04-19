import pdf from "pdf-parse";

export async function extractTextFromFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type || "application/octet-stream";

  if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdf(Buffer.from(arrayBuffer));
    return parsed.text;
  }

  return Buffer.from(arrayBuffer).toString("utf8");
}
