import { embedTexts } from "@/rag/embedder";
import type { DocumentChunk, SourceReference } from "@/lib/types";

export interface RetrievalMatch {
  chunk: DocumentChunk;
  similarity: number;
  keywordScore?: number;
  score?: number;
}

const DEFAULT_RETRIEVAL_LIMIT = Number.parseInt(process.env.RAG_TOP_K ?? "4", 10);
const DEFAULT_RELEVANCE_THRESHOLD = Number.parseFloat(process.env.RAG_RELEVANCE_THRESHOLD ?? "0.15");
const HYBRID_SEARCH_ENABLED = process.env.RAG_HYBRID_SEARCH !== "false";
const VECTOR_WEIGHT = Number.parseFloat(process.env.RAG_VECTOR_WEIGHT ?? "0.8");
const KEYWORD_WEIGHT = Number.parseFloat(process.env.RAG_KEYWORD_WEIGHT ?? "0.2");
const DEFAULT_CONTEXT_TOKEN_BUDGET = Number.parseInt(process.env.RAG_CONTEXT_TOKEN_BUDGET ?? "1800", 10);

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with"
]);

export function cosineSimilarity(left: number[], right: number[]): number {
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !stopWords.has(token)) ?? [];
}

function keywordScore(queryTokens: string[], chunk: DocumentChunk): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const chunkTokens = new Set(tokenize(`${chunk.documentTitle} ${chunk.sectionTitle ?? ""} ${chunk.content}`));
  const matches = queryTokens.filter((token) => chunkTokens.has(token)).length;
  return matches / queryTokens.length;
}

function combinedScore(similarity: number, keyword: number): number {
  if (!HYBRID_SEARCH_ENABLED) {
    return similarity;
  }

  return similarity * VECTOR_WEIGHT + keyword * KEYWORD_WEIGHT;
}

function limitByTokenBudget(matches: RetrievalMatch[], tokenBudget: number): RetrievalMatch[] {
  const selected: RetrievalMatch[] = [];
  let usedTokens = 0;

  for (const match of matches) {
    const chunkTokens = match.chunk.tokenEstimate ?? estimateTokens(match.chunk.content);

    if (selected.length > 0 && usedTokens + chunkTokens > tokenBudget) {
      continue;
    }

    selected.push(match);
    usedTokens += chunkTokens;
  }

  return selected;
}

/**
 * Performs local vector or hybrid search over indexed document chunks.
 */
export async function retrieveRelevantChunks(
  chunks: DocumentChunk[],
  question: string,
  limit = DEFAULT_RETRIEVAL_LIMIT,
  threshold = DEFAULT_RELEVANCE_THRESHOLD,
  tokenBudget = DEFAULT_CONTEXT_TOKEN_BUDGET
): Promise<RetrievalMatch[]> {
  if (chunks.length === 0) {
    return [];
  }

  const [queryEmbedding] = await embedTexts([question]);
  const queryTokens = tokenize(question);

  const ranked = chunks
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(chunk.embedding, queryEmbedding),
      keywordScore: keywordScore(queryTokens, chunk)
    }))
    .map((match) => ({
      ...match,
      score: combinedScore(match.similarity, match.keywordScore)
    }))
    .filter((match) => match.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .reduce<RetrievalMatch[]>((uniqueMatches, match) => {
      if (!uniqueMatches.some((item) => item.chunk.id === match.chunk.id)) {
        uniqueMatches.push(match);
      }
      return uniqueMatches;
    }, []);

  return limitByTokenBudget(ranked, tokenBudget).slice(0, limit);
}

export function buildContextFromMatches(matches: RetrievalMatch[]): string {
  return matches
    .map(
      ({ chunk }, index) =>
        [
          `[Source ${index + 1}] ${chunk.documentTitle}`,
          `Chunk ID: ${chunk.id}`,
          `Section: ${chunk.sectionTitle ?? "Untitled"}`,
          `Page: ${chunk.pageNumber ?? "N/A"}`,
          "",
          chunk.content
        ].join("\n")
    )
    .join("\n\n");
}

export function mapMatchesToSources(matches: RetrievalMatch[]): SourceReference[] {
  return matches.map(({ chunk, score, similarity }) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
    excerpt: chunk.content.slice(0, 220),
    similarity: score ?? similarity,
    chunkId: chunk.id,
    sectionTitle: chunk.sectionTitle,
    pageNumber: chunk.pageNumber
  }));
}
