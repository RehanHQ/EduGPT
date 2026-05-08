export type Role = "user" | "assistant";

export interface SourceReference {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  similarity: number;
  chunkId?: string;
  sectionTitle?: string;
  pageNumber?: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  sources?: SourceReference[];
  structuredResponse?: StructuredTutorResponse;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  traceId?: string;
  sessionId?: string;
}

export interface StructuredTutorResponse {
  explanation: string;
  example: string;
  key_points: string[];
  grounded: boolean;
  fallback_reason: string | null;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  sectionTitle?: string;
  pageNumber?: number;
  tokenEstimate?: number;
  organizationId?: string;
}

export interface StoredDocument {
  id: string;
  title: string;
  subject: string;
  fileName: string;
  mimeType: string;
  content: string;
  summary: string;
  createdAt: string;
  chunkCount: number;
  uploadedById?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentIndex {
  documents: StoredDocument[];
  chunks: DocumentChunk[];
}
