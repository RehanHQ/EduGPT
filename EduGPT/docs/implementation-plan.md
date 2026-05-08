# EduGPT Implementation Plan

## Phase 1: MVP

1. Build the tutoring interface
2. Accept student questions and return structured answers
3. Add document upload for notes and PDFs
4. Extract text and build a retrieval index
5. Show retrieved sources beside model answers

## Phase 2: Production Readiness

1. Add authentication and per-user workspaces
2. Move persistence from `.data/documents.json` to PostgreSQL
3. Store embeddings in a vector-enabled database
4. Persist chat sessions and message history
5. Add rate limiting and monitoring

## Phase 3: Academic Features

1. Subject-specific prompting
2. Quiz generation from uploaded notes
3. Flashcard generation
4. Citation highlighting inside answers
5. Multi-document course folders

## Engineering Notes

- Keep tutor formatting server-side so the UI stays simple.
- Use retrieval only when similarity is above a threshold.
- Log extraction failures for PDFs because scanned PDFs will need OCR later.
- Add tests for chunking, retrieval ranking, and API validation once dependencies are installed.
