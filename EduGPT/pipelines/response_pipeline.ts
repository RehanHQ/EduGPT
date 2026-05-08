import { runTutorEngine } from "@/tutor_engine/tutor_engine";
import { createTraceId, elapsedMs, logTrace, mapMatchesForTrace, nowMs } from "@/observability/logger";
import type { ChatMessage, Role } from "@/lib/types";
import type { RetrievalPipelineResult } from "@/pipelines/retrieval_pipeline";

export interface ResponsePipelineMessage {
  role: Role;
  content: string;
}

export interface ResponsePipelineInput {
  messages: ResponsePipelineMessage[];
  retrieval: RetrievalPipelineResult;
  difficulty?: unknown;
  retrievalLatencyMs?: number;
  requestStartedAt?: number;
  userId?: string;
}

export interface ResponsePipelineResult {
  message: ChatMessage;
  trace_id: string;
}

/**
 * Generates a schema-controlled tutor response using retrieved context.
 */
export async function run_response_pipeline(input: ResponsePipelineInput): Promise<ResponsePipelineResult> {
  const traceId = createTraceId();
  const requestStartedAt = input.requestStartedAt ?? nowMs();
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    throw new Error("A user question is required.");
  }

  const tutorResult = await runTutorEngine({
    query: latestUserMessage.content,
    matches: input.retrieval.matches,
    difficulty: input.difficulty
  });
  const totalLatencyMs = elapsedMs(requestStartedAt);
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: tutorResult.content,
    createdAt: new Date().toISOString(),
    sources: tutorResult.sources,
    structuredResponse: tutorResult.response,
    difficulty: tutorResult.difficulty,
    traceId
  };

  await logTrace({
    trace_id: traceId,
    timestamp: message.createdAt,
    user_query: latestUserMessage.content,
    user_id: input.userId ?? null,
    difficulty: tutorResult.difficulty,
    retrieved_chunks: mapMatchesForTrace(input.retrieval.matches),
    prompt: tutorResult.prompt,
    model: tutorResult.model,
    structured_response: tutorResult.response,
    latency: {
      retrieval_ms: input.retrievalLatencyMs ?? 0,
      llm_ms: tutorResult.llmLatencyMs,
      total_ms: totalLatencyMs
    }
  });

  return {
    message,
    trace_id: traceId
  };
}
