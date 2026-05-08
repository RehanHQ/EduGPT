export const config = {
  provider: process.env.AI_PROVIDER ?? "ollama",
  model: process.env.AI_MODEL ?? (process.env.AI_PROVIDER === "openai" ? "gpt-4.1-mini" : "llama3:8b"),
  embeddingModel:
    process.env.AI_EMBEDDING_MODEL ??
    (process.env.AI_PROVIDER === "openai" ? "text-embedding-3-small" : "nomic-embed-text"),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
};

export function requireOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Set it in .env.local or switch AI_PROVIDER to ollama.");
  }

  return apiKey;
}
