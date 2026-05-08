import type { DifficultyLevel } from "@/tutor_engine/difficulty";

export interface EvaluationQuestion {
  id: string;
  question: string;
  expected_keywords: string[];
  difficulty: DifficultyLevel;
  requires_sources: boolean;
}

export const defaultEvaluationDataset: EvaluationQuestion[] = [
  {
    id: "cs-recursion-beginner",
    question: "Explain recursion in programming.",
    expected_keywords: ["function", "calls", "base", "case"],
    difficulty: "Beginner",
    requires_sources: true
  },
  {
    id: "db-normalization-intermediate",
    question: "What is database normalization and why is it useful?",
    expected_keywords: ["database", "normalization", "redundancy", "tables"],
    difficulty: "Intermediate",
    requires_sources: true
  },
  {
    id: "algo-binary-search",
    question: "Explain binary search with an example.",
    expected_keywords: ["sorted", "middle", "half", "search"],
    difficulty: "Beginner",
    requires_sources: true
  },
  {
    id: "fallback-insufficient-context",
    question: "According to my uploaded notes, explain quantum chromodynamics.",
    expected_keywords: ["not", "enough", "material"],
    difficulty: "Advanced",
    requires_sources: false
  }
];
