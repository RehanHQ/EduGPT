import { extractTextFromFile } from "@/rag/document_loader";
import { buildDocumentChunks, summarizeContent } from "@/rag/chunker";
import { upsertDocument } from "@/lib/storage";
import type { DocumentChunk, StoredDocument } from "@/lib/types";

const allowedExtensions = (process.env.DOCUMENT_ALLOWED_EXTENSIONS ?? ".pdf,.txt,.md")
  .split(",")
  .map((extension) => extension.trim().toLowerCase())
  .filter(Boolean);

const maxFileBytes = Number.parseInt(process.env.DOCUMENT_MAX_BYTES ?? `${10 * 1024 * 1024}`, 10);

export interface IngestionPipelineInput {
  title: string;
  subject: string;
  file: File;
  organizationId?: string;
  uploadedById?: string;
}

export interface IngestionPipelineResult {
  document: StoredDocument;
  chunks: DocumentChunk[];
}

function assertSupportedFile(file: File): void {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((extension) => lowerName.endsWith(extension));

  if (!hasAllowedExtension) {
    throw new Error(`Unsupported file type. Supported files: ${allowedExtensions.join(", ")}`);
  }

  if (file.size > maxFileBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.round(maxFileBytes / 1024 / 1024)} MB.`);
  }
}

/**
 * Converts an uploaded learning resource into indexed chunks.
 */
export async function run_ingestion_pipeline(input: IngestionPipelineInput): Promise<IngestionPipelineResult> {
  const title = input.title.trim();
  const subject = input.subject.trim() || "General";

  if (!title) {
    throw new Error("Document title is required.");
  }

  assertSupportedFile(input.file);

  const loadedDocument = await extractTextFromFile(input.file);
  const content = loadedDocument.text.trim();

  if (!content) {
    throw new Error("No readable text was found in this document.");
  }

  const document: StoredDocument = {
    id: crypto.randomUUID(),
    title,
    subject,
    fileName: input.file.name,
    mimeType: loadedDocument.mimeType,
    content,
    summary: summarizeContent(content),
    createdAt: new Date().toISOString(),
    chunkCount: 0,
    organizationId: input.organizationId,
    uploadedById: input.uploadedById,
    metadata: {
      source: "upload"
    }
  };

  const chunks = await buildDocumentChunks(document);
  const scopedChunks = chunks.map((chunk) => ({
    ...chunk,
    organizationId: input.organizationId
  }));
  document.chunkCount = chunks.length;
  await upsertDocument(document, scopedChunks);

  return {
    document,
    chunks: scopedChunks
  };
}
