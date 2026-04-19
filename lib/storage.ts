import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentIndex, StoredDocument } from "@/lib/types";

const dataDirectory = path.join(process.cwd(), ".data");
const documentIndexPath = path.join(dataDirectory, "documents.json");

const emptyIndex: DocumentIndex = {
  documents: [],
  chunks: []
};

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

export async function readDocumentIndex(): Promise<DocumentIndex> {
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
  const currentIndex = await readDocumentIndex();
  const nextDocuments = currentIndex.documents.filter((item) => item.id !== document.id).concat(document);
  const nextChunks = currentIndex.chunks.filter((item) => item.documentId !== document.id).concat(chunks);

  await writeDocumentIndex({
    documents: nextDocuments.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    chunks: nextChunks
  });
}

export async function deleteDocument(documentId: string) {
  const currentIndex = await readDocumentIndex();
  await writeDocumentIndex({
    documents: currentIndex.documents.filter((item) => item.id !== documentId),
    chunks: currentIndex.chunks.filter((item) => item.documentId !== documentId)
  });
}
