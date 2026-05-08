# EduGPT

EduGPT is an AI-powered educational assistant focused on academic learning. It answers questions in a structured tutor format and supports document-grounded question answering through a retrieval-augmented generation pipeline.

## What this repo includes

- A full-stack Next.js MVP
- A tutoring UI for natural-language academic questions
- Structured response behavior for explanations, examples, and takeaways
- Document upload for `.txt`, `.md`, and `.pdf`
- Local RAG indexing backed by `.data/documents.json`
- A free local-model path through Ollama, enabled by default
- A Prisma schema for the production database design
- Architecture and implementation planning docs

## Project Structure

```text
app/
  api/
    chat/route.ts
    documents/route.ts
    documents/[id]/route.ts
  globals.css
  layout.tsx
  page.tsx
docs/
  architecture.md
  implementation-plan.md
lib/
  ai.ts
  config.ts
  documents.ts
  prompt.ts
  rag.ts
  storage.ts
  types.ts
prisma/
  schema.prisma
```

## Setup

0. Use a supported Node.js version

```bash
node -v
```

Use Node `22.x` or `20.x` for this project. Node `25` is not recommended here and can break Next.js dev mode.

The project also includes a runtime guard, so `npm run dev` and `npm run build` will stop immediately with a clear error if launched under an unsupported Node version.

1. Install dependencies

```bash
npm install
```

2. Create a local environment file

```bash
cp .env.example .env.local
```

3. Configure the model provider in `.env.local`

```bash
AI_PROVIDER=ollama
AI_MODEL=llama3:8b
AI_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

If you want OpenAI instead, switch `AI_PROVIDER=openai` and add `OPENAI_API_KEY`.

4. Install the local models

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

5. Start Ollama

```bash
ollama serve
```

6. Start the app

```bash
npm run dev
```

7. Open `http://localhost:3000`

## MVP Behavior

- If no study material is uploaded, EduGPT answers directly from the configured model.
- If documents are uploaded, the app embeds the latest question, retrieves relevant chunks, and includes them in the prompt.
- Retrieved sources are shown under each assistant answer.

## Recommended Next Steps

1. Replace local JSON storage with PostgreSQL and a vector store.
2. Add authentication and user-scoped documents.
3. Persist chat sessions.
4. Add OCR support for scanned PDFs.
5. Add test coverage once dependencies are installed.
