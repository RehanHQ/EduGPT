# EduGPT Architecture

## Overview

EduGPT is a full-stack educational assistant with two layers:

1. Tutor chat for structured academic answers
2. Retrieval-augmented generation for uploaded study materials

This repository ships with a local JSON-backed MVP for fast development. The production path is documented through the Prisma schema in `prisma/schema.prisma`.

## Request Flow

1. The student enters a question in the web UI.
2. The frontend sends the recent conversation to `POST /api/chat`.
3. The server loads the local document index from `.data/documents.json`.
4. It embeds the latest user question and retrieves the most relevant chunks.
5. The prompt is assembled with:
   - the EduGPT system instructions
   - the recent chat history
   - retrieved study excerpts when available
6. The model generates a structured answer.
7. The response returns both the answer and the retrieved source references.

## RAG Pipeline

1. Upload file through `POST /api/documents`
2. Extract text from `.txt`, `.md`, or `.pdf`
3. Normalize and chunk the text with overlap
4. Generate embeddings for each chunk
5. Persist documents and chunks to the local JSON index
6. On query, compute the embedding for the question
7. Rank chunks by cosine similarity
8. Send top matches into the prompt

## Suggested Production Stack

- Frontend: Next.js App Router
- Backend: Next.js route handlers or FastAPI if you split services later
- Relational data: PostgreSQL
- ORM: Prisma
- Vector search: pgvector, Pinecone, Weaviate, or Chroma
- File storage: S3, GCS, or Supabase Storage
- Auth: NextAuth or Clerk

## Major Modules

- `app/page.tsx`: main learning workspace
- `app/api/chat/route.ts`: tutoring endpoint
- `app/api/documents/route.ts`: upload and indexing endpoint
- `lib/rag.ts`: chunking, embeddings, similarity, retrieval
- `lib/storage.ts`: local MVP persistence
- `lib/prompt.ts`: tutoring rules and prompt assembly
