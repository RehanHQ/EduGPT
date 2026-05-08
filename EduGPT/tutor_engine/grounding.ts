import type { RetrievalMatch } from "@/rag/vector_store";

const minimumContextMatches = Number.parseInt(process.env.TUTOR_MIN_CONTEXT_MATCHES ?? "1", 10);
const minimumContextScore = Number.parseFloat(process.env.TUTOR_MIN_CONTEXT_SCORE ?? "0.15");

export interface GroundingDecision {
  grounded: boolean;
  reason: string | null;
}

export function assessGrounding(matches: RetrievalMatch[]): GroundingDecision {
  if (matches.length < minimumContextMatches) {
    return {
      grounded: false,
      reason: "No retrieved chunks passed the relevance threshold."
    };
  }

  const strongestMatch = Math.max(...matches.map((match) => match.similarity));

  if (strongestMatch < minimumContextScore) {
    return {
      grounded: false,
      reason: "Retrieved chunks were below the minimum grounding score."
    };
  }

  return {
    grounded: true,
    reason: null
  };
}
