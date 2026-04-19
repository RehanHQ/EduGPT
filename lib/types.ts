export type Role = "user" | "assistant";

export interface SourceReference {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  sources?: SourceReference[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
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
}

export interface DocumentIndex {
  documents: StoredDocument[];
  chunks: DocumentChunk[];
}
