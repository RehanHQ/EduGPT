import { z } from "zod";

export const tutorResponseSchema = z.object({
  explanation: z.string().trim().min(1),
  example: z.string().trim().min(1),
  key_points: z.array(z.string().trim().min(1)).min(1),
  grounded: z.boolean(),
  fallback_reason: z.string().trim().nullable()
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;

export function parseTutorResponse(rawText: string): TutorResponse | null {
  const jsonText = extractJsonObject(rawText);

  if (!jsonText) {
    return null;
  }

  try {
    return tutorResponseSchema.parse(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

export function createFallbackResponse(reason: string): TutorResponse {
  return {
    explanation:
      "I do not have enough relevant study material to answer this question reliably from your uploaded sources.",
    example:
      "Upload notes that define the topic or ask a question about material that has already been indexed.",
    key_points: [
      "No sufficiently relevant source context was found.",
      "I should not invent an answer or cite sources that were not retrieved.",
      "Add or refine study material, then ask again."
    ],
    grounded: false,
    fallback_reason: reason
  };
}

export function repairTutorResponse(rawText: string): TutorResponse {
  const parsed = parseTutorResponse(rawText);

  if (parsed) {
    return parsed;
  }

  const normalized = rawText.trim();

  if (!normalized) {
    return createFallbackResponse("The model returned an empty response.");
  }

  return {
    explanation: normalized,
    example: "No structured example was provided by the model.",
    key_points: ["The model response was repaired into the required tutor schema."],
    grounded: true,
    fallback_reason: null
  };
}

export function formatTutorResponseForChat(response: TutorResponse): string {
  return [
    "Explanation",
    response.explanation,
    "",
    "Example",
    response.example,
    "",
    "Key Points",
    ...response.key_points.map((point) => `- ${point}`)
  ].join("\n");
}

function extractJsonObject(rawText: string): string | null {
  const trimmed = rawText.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      return candidate;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}
