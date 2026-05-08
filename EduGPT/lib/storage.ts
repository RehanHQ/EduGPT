import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentIndex, StoredDocument } from "@/lib/types";
import { prisma } from "@/lib/db";

const dataDirectory = path.join(process.cwd(), ".data");
const documentIndexPath = path.join(dataDirectory, "documents.json");

const emptyIndex: DocumentIndex = {
  documents: [],
  chunks: []
};

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

function parseEmbedding(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function readDocumentIndex(options: { organizationId?: string } = {}): Promise<DocumentIndex> {
  try {
    const documents = await prisma.document.findMany({
      where: options.organizationId ? { organizationId: options.organizationId } : undefined,
      include: {
        chunks: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        subject: document.subject,
        fileName: document.fileName,
        mimeType: document.mimeType,
        content: document.content,
        summary: document.summary,
        createdAt: document.createdAt.toISOString(),
        chunkCount: document.chunks.length,
        uploadedById: document.uploadedById,
        organizationId: document.organizationId,
        metadata: parseMetadata(document.metadata)
      })),
      chunks: documents.flatMap((document) =>
        document.chunks.map((chunk) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          documentTitle: document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: parseEmbedding(chunk.embedding),
          sectionTitle: chunk.sectionTitle ?? undefined,
          pageNumber: chunk.pageNumber ?? undefined,
          tokenEstimate: chunk.tokenEstimate ?? undefined,
          organizationId: chunk.organizationId
        }))
      )
    };
  } catch {
    return readLocalDocumentIndex();
  }
}

async function readLocalDocumentIndex(): Promise<DocumentIndex> {
  await ensureDataDirectory();

  try {
    const raw = await readFile(documentIndexPath, "utf8");
    return JSON.parse(raw) as DocumentIndex;
  } catch (error) {
    return emptyIndex;
  }
}

export async function writeDocumentIndex(index: DocumentIndex) {
  await ensureDataDirectory();
  await writeFile(documentIndexPath, JSON.stringify(index, null, 2), "utf8");
}

export async function upsertDocument(document: StoredDocument, chunks: DocumentIndex["chunks"]) {
  if (document.organizationId && document.uploadedById) {
    await prisma.document.upsert({
      where: { id: document.id },
      update: {
        title: document.title,
        subject: document.subject,
        fileName: document.fileName,
        mimeType: document.mimeType,
        summary: document.summary,
        content: document.content,
        metadata: JSON.stringify(document.metadata ?? {})
      },
      create: {
        id: document.id,
        title: document.title,
        subject: document.subject,
        fileName: document.fileName,
        mimeType: document.mimeType,
        summary: document.summary,
        content: document.content,
        metadata: JSON.stringify(document.metadata ?? {}),
        uploadedById: document.uploadedById,
        organizationId: document.organizationId
      }
    });
    await prisma.documentChunk.deleteMany({
      where: { documentId: document.id }
    });
    await prisma.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        organizationId: document.organizationId!,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: JSON.stringify(chunk.embedding),
        sectionTitle: chunk.sectionTitle ?? null,
        pageNumber: chunk.pageNumber ?? null,
        tokenEstimate: chunk.tokenEstimate ?? null
      }))
    });
    return;
  }

  const currentIndex = await readDocumentIndex();
  const nextDocuments = currentIndex.documents.filter((item) => item.id !== document.id).concat(document);
  const nextChunks = currentIndex.chunks.filter((item) => item.documentId !== document.id).concat(chunks);

  await writeDocumentIndex({
    documents: nextDocuments.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    chunks: nextChunks
  });
}

export async function deleteDocument(documentId: string, options: { organizationId?: string } = {}) {
  try {
    await prisma.document.deleteMany({
      where: {
        id: documentId,
        ...(options.organizationId ? { organizationId: options.organizationId } : {})
      }
    });
    return;
  } catch {
    // Fall back to local JSON for pre-database development data.
  }

  const currentIndex = await readLocalDocumentIndex();
  await writeDocumentIndex({
    documents: currentIndex.documents.filter((item) => item.id !== documentId),
    chunks: currentIndex.chunks.filter((item) => item.documentId !== documentId)
  });
}
