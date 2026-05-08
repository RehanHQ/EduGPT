import type { ChatMessage, StructuredTutorResponse } from "@/lib/types";
import type { EvaluationQuestion } from "@/evaluation/datasets";
import type { RetrievalPipelineResult } from "@/pipelines/retrieval_pipeline";

export interface ScoreBreakdown {
  structure: number;
  grounding: number;
  relevance: number;
  fallback: number;
  total: number;
  failures: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase();
}

function scoreStructure(response: StructuredTutorResponse | undefined): { score: number; failures: string[] } {
  const failures: string[] = [];

  if (!response?.explanation?.trim()) {
    failures.push("Missing explanation.");
  }

  if (!response?.example?.trim()) {
    failures.push("Missing example.");
  }

  if (!response?.key_points?.length) {
    failures.push("Missing key points.");
  }

  return {
    score: failures.length === 0 ? 1 : 0,
    failures
  };
}

function scoreGrounding(
  question: EvaluationQuestion,
  message: ChatMessage,
  retrieval: RetrievalPipelineResult
): { score: number; failures: string[] } {
  const failures: string[] = [];
  const sources = message.sources ?? [];

  if (question.requires_sources && sources.length === 0) {
    failures.push("Expected sources but none were returned.");
  }

  const retrievedChunkIds = new Set(retrieval.matches.map((match) => match.chunk.id));
  const invalidSource = sources.find((source) => source.chunkId && !retrievedChunkIds.has(source.chunkId));

  if (invalidSource) {
    failures.push(`Source ${invalidSource.chunkId} was not part of retrieved chunks.`);
  }

  return {
    score: failures.length === 0 ? 1 : 0,
    failures
  };
}

function scoreRelevance(
  question: EvaluationQuestion,
  response: StructuredTutorResponse | undefined
): { score: number; failures: string[] } {
  const answerText = normalizeText(
    [response?.explanation ?? "", response?.example ?? "", ...(response?.key_points ?? [])].join(" ")
  );
  const matchedKeywords = question.expected_keywords.filter((keyword) =>
    answerText.includes(normalizeText(keyword))
  );
  const score = question.expected_keywords.length === 0 ? 1 : matchedKeywords.length / question.expected_keywords.length;

  return {
    score,
    failures: score >= 0.5 ? [] : [`Matched only ${matchedKeywords.length}/${question.expected_keywords.length} expected keywords.`]
  };
}

function scoreFallback(
  question: EvaluationQuestion,
  response: StructuredTutorResponse | undefined,
  retrieval: RetrievalPipelineResult
): { score: number; failures: string[] } {
  if (question.requires_sources) {
    return {
      score: 1,
      failures: []
    };
  }

  const correctlyFellBack = retrieval.matches.length === 0 && response?.grounded === false;

  return {
    score: correctlyFellBack ? 1 : 0,
    failures: correctlyFellBack ? [] : ["Expected fallback for insufficient context."]
  };
}

export function scoreEvaluationResult(
  question: EvaluationQuestion,
  message: ChatMessage,
  retrieval: RetrievalPipelineResult
): ScoreBreakdown {
  const response = message.structuredResponse;
  const structure = scoreStructure(response);
  const grounding = scoreGrounding(question, message, retrieval);
  const relevance = scoreRelevance(question, response);
  const fallback = scoreFallback(question, response, retrieval);
  const total = (structure.score + grounding.score + relevance.score + fallback.score) / 4;

  return {
    structure: structure.score,
    grounding: grounding.score,
    relevance: relevance.score,
    fallback: fallback.score,
    total,
    failures: [...structure.failures, ...grounding.failures, ...relevance.failures, ...fallback.failures]
  };
}
