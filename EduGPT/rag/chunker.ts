import { embedTexts } from "@/rag/embedder";
import type { DocumentChunk, StoredDocument } from "@/lib/types";

const CHUNK_SIZE = Number.parseInt(process.env.RAG_CHUNK_SIZE ?? "900", 10);
const CHUNK_OVERLAP = Number.parseInt(process.env.RAG_CHUNK_OVERLAP ?? "180", 10);
const MAX_SECTION_CHARS = Math.max(CHUNK_SIZE * 2, CHUNK_SIZE);

interface SemanticBlock {
  text: string;
  sectionTitle?: string;
  pageNumber?: number;
}

interface ChunkDraft {
  content: string;
  sectionTitle?: string;
  pageNumber?: number;
  tokenEstimate: number;
}

export function summarizeContent(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) {
    return false;
  }

  return (
    /^#{1,6}\s+\S/.test(trimmed) ||
    /^[A-Z][A-Z0-9\s:,-]{3,}$/.test(trimmed) ||
    /^\d+(\.\d+)*\s+[A-Z]/.test(trimmed)
  );
}

function pageNumberFromLine(line: string): number | undefined {
  const match = line.trim().match(/^(?:page|p\.)\s*(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function splitIntoSemanticBlocks(text: string): SemanticBlock[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const blocks: SemanticBlock[] = [];
  const lines = normalized.split("\n");
  let currentLines: string[] = [];
  let currentSection: string | undefined;
  let currentPage: number | undefined;

  function flushBlock(): void {
    const text = currentLines.join("\n").trim();
    if (text) {
      blocks.push({
        text,
        sectionTitle: currentSection,
        pageNumber: currentPage
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const pageNumber = pageNumberFromLine(line);
    if (pageNumber !== undefined) {
      currentPage = pageNumber;
      continue;
    }

    if (isHeading(line)) {
      flushBlock();
      currentSection = line.replace(/^#{1,6}\s+/, "").trim();
      currentLines.push(line.trim());
      continue;
    }

    if (!line.trim()) {
      flushBlock();
      continue;
    }

    currentLines.push(line);

    if (currentLines.join("\n").length >= MAX_SECTION_CHARS) {
      flushBlock();
    }
  }

  flushBlock();
  return blocks;
}

function splitBlockWithOverlap(block: SemanticBlock): ChunkDraft[] {
  if (block.text.length <= CHUNK_SIZE) {
    return [
      {
        content: block.text,
        sectionTitle: block.sectionTitle,
        pageNumber: block.pageNumber,
        tokenEstimate: estimateTokens(block.text)
      }
    ];
  }

  const chunks: ChunkDraft[] = [];
  let start = 0;
  const text = block.text;

  while (start < text.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, text.length);
    const boundary = text.lastIndexOf("\n", hardEnd);
    const end = boundary > start + CHUNK_SIZE * 0.55 ? boundary : hardEnd;
    const slice = text.slice(start, end).trim();

    if (slice) {
      chunks.push({
        content: slice,
        sectionTitle: block.sectionTitle,
        pageNumber: block.pageNumber,
        tokenEstimate: estimateTokens(slice)
      });
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export function chunkText(text: string): string[] {
  return chunkDocumentText(text).map((chunk) => chunk.content);
}

export function chunkDocumentText(text: string): ChunkDraft[] {
  return splitIntoSemanticBlocks(text).flatMap((block) => splitBlockWithOverlap(block));
}

export async function buildDocumentChunks(document: StoredDocument): Promise<DocumentChunk[]> {
  const chunks = chunkDocumentText(document.content);

  if (chunks.length === 0) {
    return [];
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  return chunks.map((chunk, chunkIndex) => ({
    id: `${document.id}:${chunkIndex}`,
    documentId: document.id,
    documentTitle: document.title,
    chunkIndex,
    content: chunk.content,
    embedding: embeddings[chunkIndex],
    sectionTitle: chunk.sectionTitle,
    pageNumber: chunk.pageNumber,
    tokenEstimate: chunk.tokenEstimate
  }));
}
