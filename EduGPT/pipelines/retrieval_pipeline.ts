import { retrieveRelevantChunks, type RetrievalMatch } from "@/rag/vector_store";
import { readDocumentIndex } from "@/lib/storage";

const defaultTopK = Number.parseInt(process.env.RAG_TOP_K ?? "4", 10);
const defaultRelevanceThreshold = Number.parseFloat(process.env.RAG_RELEVANCE_THRESHOLD ?? "0.15");
const defaultContextTokenBudget = Number.parseInt(process.env.RAG_CONTEXT_TOKEN_BUDGET ?? "1800", 10);

export interface RetrievalPipelineInput {
  query: string;
  topK?: number;
  relevanceThreshold?: number;
  contextTokenBudget?: number;
  organizationId?: string;
}

export interface RetrievalPipelineResult {
  query: string;
  matches: RetrievalMatch[];
}

/**
 * Retrieves relevant indexed chunks for a student query.
 */
export async function run_retrieval_pipeline(input: RetrievalPipelineInput): Promise<RetrievalPipelineResult> {
  const query = input.query.trim();

  if (!query) {
    throw new Error("A user question is required.");
  }

  const index = await readDocumentIndex({ organizationId: input.organizationId });
  const matches = await retrieveRelevantChunks(
    index.chunks,
    query,
    input.topK ?? defaultTopK,
    input.relevanceThreshold ?? defaultRelevanceThreshold,
    input.contextTokenBudget ?? defaultContextTokenBudget
  );

  return {
    query,
    matches
  };
}
