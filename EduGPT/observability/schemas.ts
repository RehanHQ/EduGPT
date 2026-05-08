import { z } from "zod";

export const traceRetrievedChunkSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string(),
  document_title: z.string(),
  chunk_index: z.number(),
  section_title: z.string().nullable(),
  page_number: z.number().nullable(),
  score: z.number(),
  similarity: z.number(),
  keyword_score: z.number().nullable(),
  excerpt: z.string()
});

export const traceLatencySchema = z.object({
  retrieval_ms: z.number(),
  llm_ms: z.number(),
  total_ms: z.number()
});

export const traceRecordSchema = z.object({
  trace_id: z.string(),
  user_id: z.string().nullable().optional(),
  timestamp: z.string(),
  user_query: z.string(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  retrieved_chunks: z.array(traceRetrievedChunkSchema),
  prompt: z.string().nullable(),
  model: z.string(),
  structured_response: z.object({
    explanation: z.string(),
    example: z.string(),
    key_points: z.array(z.string()),
    grounded: z.boolean(),
    fallback_reason: z.string().nullable()
  }),
  latency: traceLatencySchema
});

export type TraceRetrievedChunk = z.infer<typeof traceRetrievedChunkSchema>;
export type TraceLatency = z.infer<typeof traceLatencySchema>;
export type TraceRecord = z.infer<typeof traceRecordSchema>;
