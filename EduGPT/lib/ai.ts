import OpenAI from "openai";
import { config, requireOpenAIApiKey } from "@/lib/config";

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: requireOpenAIApiKey()
    });
  }

  return openAIClient;
}

function getOllamaUrl(path: string) {
  return `${config.ollamaBaseUrl.replace(/\/+$/, "")}${path}`;
}

function deterministicEmbedding(text: string, dimensions = 256) {
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();

  for (let index = 0; index < normalized.length; index += 1) {
    vector[index % dimensions] += (normalized.charCodeAt(index) % 29) / 29;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export async function generateTutorReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string
) {
  if (config.provider === "openai") {
    const client = getOpenAIClient();
    const completion = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        ...messages
      ]
    });

    return completion.output_text?.trim() ?? "";
  }

  if (config.provider === "ollama") {
    const response = await fetch(getOllamaUrl("/api/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...messages
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama chat request failed. Ensure Ollama is running and the model is pulled. ${errorText}`
      );
    }

    const payload = (await response.json()) as {
      message?: {
        content?: string;
      };
    };

    return payload.message?.content?.trim() ?? "";
  }

  throw new Error(`Unsupported AI_PROVIDER: ${config.provider}`);
}

async function fetchOllamaEmbedding(text: string) {
  const response = await fetch(getOllamaUrl("/api/embeddings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      prompt: text
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { embedding?: number[] };
  return payload.embedding ?? deterministicEmbedding(text);
}

export async function generateEmbeddings(texts: string[]) {
  if (texts.length === 0) {
    return [];
  }

  if (config.provider === "openai") {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: config.embeddingModel,
      input: texts
    });

    return response.data.map((item) => item.embedding);
  }

  if (config.provider === "ollama") {
    try {
      return await Promise.all(texts.map((text) => fetchOllamaEmbedding(text)));
    } catch {
      return texts.map((text) => deterministicEmbedding(text));
    }
  }

  return texts.map((text) => deterministicEmbedding(text));
}
