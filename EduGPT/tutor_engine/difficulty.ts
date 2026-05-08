export const difficultyLevels = ["Beginner", "Intermediate", "Advanced"] as const;

export type DifficultyLevel = (typeof difficultyLevels)[number];

export const defaultDifficulty: DifficultyLevel = "Beginner";

const difficultyGuidance: Record<DifficultyLevel, string> = {
  Beginner:
    "Use simple language, define terms before using them, and keep the example small and concrete.",
  Intermediate:
    "Assume basic familiarity, explain the mechanism clearly, and include practical tradeoffs when useful.",
  Advanced:
    "Use precise technical language, include edge cases when relevant, and keep the explanation concise."
};

export function normalizeDifficulty(value: unknown): DifficultyLevel {
  if (typeof value !== "string") {
    return defaultDifficulty;
  }

  const normalized = difficultyLevels.find((level) => level.toLowerCase() === value.trim().toLowerCase());
  return normalized ?? defaultDifficulty;
}

export function getDifficultyGuidance(difficulty: DifficultyLevel): string {
  return difficultyGuidance[difficulty];
}
