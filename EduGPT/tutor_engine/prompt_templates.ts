import { getDifficultyGuidance, type DifficultyLevel } from "@/tutor_engine/difficulty";

export interface PromptTemplateInput {
  query: string;
  context: string;
  difficulty: DifficultyLevel;
}

export function grounded_answer_prompt(input: PromptTemplateInput): string {
  return [
    "You are EduGPT, a structured academic tutor.",
    "",
    "Answer the student using only the provided study material.",
    "Do not use outside knowledge.",
    "Do not cite or imply sources that are not in the provided context.",
    "",
    `Difficulty: ${input.difficulty}`,
    `Difficulty guidance: ${getDifficultyGuidance(input.difficulty)}`,
    "",
    "Return only valid JSON with this exact shape:",
    "{",
    '  "explanation": "string",',
    '  "example": "string",',
    '  "key_points": ["string"],',
    '  "grounded": true,',
    '  "fallback_reason": null',
    "}",
    "",
    "Study material:",
    input.context,
    "",
    "Student question:",
    input.query
  ].join("\n");
}

export function no_context_fallback_prompt(input: Pick<PromptTemplateInput, "query" | "difficulty">): string {
  return [
    "You are EduGPT, a reliable academic tutor.",
    "",
    "There is not enough retrieved study material to answer this question safely.",
    "Return only valid JSON with this exact shape:",
    "{",
    '  "explanation": "string",',
    '  "example": "string",',
    '  "key_points": ["string"],',
    '  "grounded": false,',
    '  "fallback_reason": "string"',
    "}",
    "",
    `Difficulty: ${input.difficulty}`,
    `Difficulty guidance: ${getDifficultyGuidance(input.difficulty)}`,
    "",
    "Student question:",
    input.query
  ].join("\n");
}
