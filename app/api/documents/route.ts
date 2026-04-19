import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/documents";
import { buildDocumentChunks, summarizeContent } from "@/lib/rag";
import { readDocumentIndex, upsertDocument } from "@/lib/storage";
import type { StoredDocument } from "@/lib/types";

export async function GET() {
  const index = await readDocumentIndex();
  return NextResponse.json({ documents: index.documents });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subject = String(formData.get("subject") ?? "General").trim();
    const file = formData.get("file");

    if (!title) {
      return NextResponse.json({ error: "Document title is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
    }

    const content = (await extractTextFromFile(file)).trim();

    if (!content) {
      return NextResponse.json({ error: "No readable text was found in this document." }, { status: 400 });
    }

    const document: StoredDocument = {
      id: crypto.randomUUID(),
      title,
      subject: subject || "General",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      content,
      summary: summarizeContent(content),
      createdAt: new Date().toISOString(),
      chunkCount: 0
    };

    const chunks = await buildDocumentChunks(document);
    document.chunkCount = chunks.length;
    await upsertDocument(document, chunks);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
