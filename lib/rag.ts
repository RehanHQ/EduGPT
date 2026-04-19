import { generateEmbeddings } from "@/lib/ai";
import type { DocumentChunk, SourceReference, StoredDocument } from "@/lib/types";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 180;

export function summarizeContent(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

export function chunkText(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const slice = normalized.slice(start, end).trim();

    if (slice) {
      chunks.push(slice);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export async function embedTexts(texts: string[]) {
  return generateEmbeddings(texts);
}

export async function buildDocumentChunks(document: StoredDocument): Promise<DocumentChunk[]> {
  const chunks = chunkText(document.content);

  if (chunks.length === 0) {
    return [];
  }

  const embeddings = await embedTexts(chunks);

  return chunks.map((content, chunkIndex) => ({
    id: `${document.id}:${chunkIndex}`,
    documentId: document.id,
    documentTitle: document.title,
    chunkIndex,
    content,
    embedding: embeddings[chunkIndex]
  }));
}

export function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function retrieveRelevantChunks(chunks: DocumentChunk[], question: string, limit = 4) {
  if (chunks.length === 0) {
    return [];
  }

  const [queryEmbedding] = await embedTexts([question]);

  return chunks
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(chunk.embedding, queryEmbedding)
    }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit)
    .filter((item) => item.similarity > 0.15);
}

export function buildContextFromMatches(matches: Array<{ chunk: DocumentChunk; similarity: number }>) {
  return matches
    .map(
      ({ chunk }, index) =>
        `[Source ${index + 1}] ${chunk.documentTitle} (chunk ${chunk.chunkIndex + 1})\n${chunk.content}`
    )
    .join("\n\n");
}

export function mapMatchesToSources(matches: Array<{ chunk: DocumentChunk; similarity: number }>): SourceReference[] {
  return matches.map(({ chunk, similarity }) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
    excerpt: chunk.content.slice(0, 220),
    similarity
  }));
}
