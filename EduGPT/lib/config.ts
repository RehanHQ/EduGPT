const provider = process.env.AI_PROVIDER ?? "ollama";
const hostedModelDefaults: Record<string, string> = {
  openai: "gpt-4.1-mini",
  groq: "llama-3.3-70b-versatile",
  grok: "llama-3.3-70b-versatile"
};

export const config = {
  provider,
  model: process.env.AI_MODEL ?? hostedModelDefaults[provider] ?? "llama3:8b",
  embeddingModel:
    process.env.AI_EMBEDDING_MODEL ??
    (provider === "openai" ? "text-embedding-3-small" : "nomic-embed-text"),
  groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
};

export function requireOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Set it in .env.local or switch AI_PROVIDER to ollama.");
  }

  return apiKey;
}

export function requireGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.GROK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY. Set it in .env.local or switch AI_PROVIDER to ollama.");
  }

  return apiKey;
}
