import { appendTrace } from "@/observability/trace_store";
import type { TraceRecord } from "@/observability/schemas";
import type { RetrievalMatch } from "@/rag/vector_store";

export function createTraceId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt;
}

export function redactSensitiveText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/(OPENAI_API_KEY\s*=\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s]+/gi, "$1[REDACTED]");
}

export function mapMatchesForTrace(matches: RetrievalMatch[]) {
  return matches.map(({ chunk, similarity, keywordScore, score }) => ({
    chunk_id: chunk.id,
    document_id: chunk.documentId,
    document_title: chunk.documentTitle,
    chunk_index: chunk.chunkIndex,
    section_title: chunk.sectionTitle ?? null,
    page_number: chunk.pageNumber ?? null,
    score: score ?? similarity,
    similarity,
    keyword_score: keywordScore ?? null,
    excerpt: chunk.content.slice(0, 300)
  }));
}

/**
 * Writes a trace record without allowing logging failures to affect chat behavior.
 */
export async function logTrace(record: TraceRecord): Promise<void> {
  try {
    await appendTrace({
      ...record,
      user_query: redactSensitiveText(record.user_query) ?? "",
      prompt: redactSensitiveText(record.prompt),
      structured_response: {
        ...record.structured_response,
        explanation: redactSensitiveText(record.structured_response.explanation) ?? "",
        example: redactSensitiveText(record.structured_response.example) ?? "",
        key_points: record.structured_response.key_points.map((point) => redactSensitiveText(point) ?? "")
      }
    });
  } catch (error) {
    console.error("Failed to write EduGPT trace", error);
  }
}
