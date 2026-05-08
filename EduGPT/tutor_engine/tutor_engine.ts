import { generateTutorReply } from "@/lib/ai";
import { config } from "@/lib/config";
import { buildContextFromMatches, mapMatchesToSources, type RetrievalMatch } from "@/rag/vector_store";
import { normalizeDifficulty, type DifficultyLevel } from "@/tutor_engine/difficulty";
import { assessGrounding } from "@/tutor_engine/grounding";
import { grounded_answer_prompt, no_context_fallback_prompt } from "@/tutor_engine/prompt_templates";
import {
  createFallbackResponse,
  formatTutorResponseForChat,
  repairTutorResponse,
  type TutorResponse
} from "@/tutor_engine/response_schema";
import type { SourceReference } from "@/lib/types";

export interface TutorEngineInput {
  query: string;
  matches: RetrievalMatch[];
  difficulty?: unknown;
}

export interface TutorEngineResult {
  response: TutorResponse;
  content: string;
  sources: SourceReference[];
  difficulty: DifficultyLevel;
  prompt: string | null;
  model: string;
  llmLatencyMs: number;
}

/**
 * Central Phase 2 tutor engine for grounded, schema-controlled answers.
 */
export async function runTutorEngine(input: TutorEngineInput): Promise<TutorEngineResult> {
  const difficulty = normalizeDifficulty(input.difficulty);
  const groundingDecision = assessGrounding(input.matches);

  if (!groundingDecision.grounded) {
    const fallback = createFallbackResponse(groundingDecision.reason ?? "No sufficient context was retrieved.");
    return {
      response: fallback,
      content: formatTutorResponseForChat(fallback),
      sources: [],
      difficulty,
      prompt: null,
      model: config.model,
      llmLatencyMs: 0
    };
  }

  const context = buildContextFromMatches(input.matches);
  const prompt = grounded_answer_prompt({
    query: input.query,
    context,
    difficulty
  });

  const llmStartedAt = Date.now();
  const rawText = await generateTutorReply(
    [
      {
        role: "user",
        content: prompt
      }
    ],
    "You produce strictly valid JSON for EduGPT tutor responses."
  );
  const llmLatencyMs = Date.now() - llmStartedAt;

  const response = repairTutorResponse(rawText);

  if (!response.grounded) {
    const fallback = createFallbackResponse(response.fallback_reason ?? "The model did not produce a grounded answer.");
    return {
      response: fallback,
      content: formatTutorResponseForChat(fallback),
      sources: [],
      difficulty,
      prompt,
      model: config.model,
      llmLatencyMs
    };
  }

  return {
    response: {
      ...response,
      grounded: true,
      fallback_reason: null
    },
    content: formatTutorResponseForChat(response),
    sources: mapMatchesToSources(input.matches),
    difficulty,
    prompt,
    model: config.model,
    llmLatencyMs
  };
}

export async function runTutorFallbackPrompt(query: string, difficultyInput?: unknown): Promise<TutorEngineResult> {
  const difficulty = normalizeDifficulty(difficultyInput);
  const prompt = no_context_fallback_prompt({
    query,
    difficulty
  });
  const llmStartedAt = Date.now();
  const rawText = await generateTutorReply(
    [
      {
        role: "user",
        content: prompt
      }
    ],
    "You produce strictly valid JSON for EduGPT fallback tutor responses."
  );
  const llmLatencyMs = Date.now() - llmStartedAt;
  const response = repairTutorResponse(rawText);
  const fallback = response.grounded
    ? createFallbackResponse("No sufficient context was retrieved.")
    : response;

  return {
    response: fallback,
    content: formatTutorResponseForChat(fallback),
    sources: [],
    difficulty,
    prompt,
    model: config.model,
    llmLatencyMs
  };
}
