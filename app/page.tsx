"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import type { ChatMessage, SourceReference, StoredDocument } from "@/lib/types";

const starterMessage: ChatMessage = {
  id: "starter",
  role: "assistant",
  createdAt: "2026-04-19T00:00:00.000Z",
  content: [
    "1. Direct Answer",
    "EduGPT is ready to explain topics, solve academic questions, and ground answers in your uploaded study material.",
    "",
    "2. Explanation",
    "Ask a question in natural language. For the advanced workflow, upload notes or a PDF first and I will retrieve relevant excerpts before answering.",
    "",
    "3. Example",
    "Try: \"Explain dynamic programming with an example in C++.\"",
    "",
    "4. Key Takeaways",
    "- Structured tutoring format",
    "- Document-based learning with retrieval",
    "- Clear, academic-first responses"
  ].join("\n")
};

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatDate(isoString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [file, setFile] = useState<File | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isChatPending, startChatTransition] = useTransition();
  const [isUploadPending, startUploadTransition] = useTransition();

  useEffect(() => {
    void loadDocuments();
  }, []);

  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunkCount, 0),
    [documents]
  );

  async function loadDocuments() {
    const data = await parseJson<{ documents: StoredDocument[] }>(await fetch("/api/documents"));
    setDocuments(data.documents);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((current) => current.concat(userMessage));
    setQuestion("");
    setChatError(null);

    startChatTransition(async () => {
      try {
        const data = await parseJson<{ message: ChatMessage }>(
          await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messages: messages.concat(userMessage).map(({ role, content }) => ({ role, content }))
            })
          })
        );

        setMessages((current) => current.concat(data.message));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to answer right now.";
        setChatError(message);
      }
    });
  }

  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !file) {
      setUploadError("Add a document title and choose a file before uploading.");
      return;
    }

    setUploadError(null);

    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", title.trim());
        formData.set("subject", subject);
        formData.set("file", file);

        await parseJson<{ document: StoredDocument }>(
          await fetch("/api/documents", {
            method: "POST",
            body: formData
          })
        );

        setTitle("");
        setSubject("Computer Science");
        setFile(null);
        await loadDocuments();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setUploadError(message);
      }
    });
  }

  async function removeDocument(documentId: string) {
    await parseJson<{ ok: boolean }>(
      await fetch(`/api/documents/${documentId}`, {
        method: "DELETE"
      })
    );

    await loadDocuments();
  }

  return (
    <main className="shell">
      <aside className="sidebar card">
        <div className="brand">
          <span className="eyebrow">AI Tutor + RAG</span>
          <h1>EduGPT</h1>
          <p>
            A focused academic assistant that explains, solves, and cites relevant study
            material from uploaded notes.
          </p>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <strong>{documents.length}</strong>
            <span className="muted">Documents indexed</span>
          </div>
          <div className="stat">
            <strong>{totalChunks}</strong>
            <span className="muted">Retrieval chunks</span>
          </div>
        </div>

        <div className="list">
          {documents.length === 0 ? (
            <div className="doc-card">
              <h3>No study materials yet</h3>
              <p className="tiny">Upload notes, text files, or PDFs to enable grounded answers.</p>
            </div>
          ) : (
            documents.map((document) => (
              <div className="doc-card" key={document.id}>
                <div className="split">
                  <h3>{document.title}</h3>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void removeDocument(document.id)}
                  >
                    Delete
                  </button>
                </div>
                <p className="tiny">{document.summary}</p>
                <div className="tag-row">
                  <span className="tag">{document.subject}</span>
                  <span className="tag">{document.chunkCount} chunks</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="main">
        <div className="hero card">
          <span className="eyebrow">Personalized Learning</span>
          <h2>Ask theory, code, or numeric questions in one place.</h2>
          <div className="hero-grid">
            <div className="feature">
              <strong>Structured Answers</strong>
              <span className="tiny">Direct answer, explanation, example, and key takeaways.</span>
            </div>
            <div className="feature">
              <strong>Academic Focus</strong>
              <span className="tiny">Optimized for study support instead of open-ended chat.</span>
            </div>
            <div className="feature">
              <strong>Document Grounding</strong>
              <span className="tiny">Retrieves relevant excerpts before answering.</span>
            </div>
          </div>
        </div>

        <div className="workspace">
          <div className="card panel">
            <h2 className="section-title">Tutor Chat</h2>
            <div className="messages">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-header">
                    <span>{message.role === "assistant" ? "EduGPT" : "Student"}</span>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  <pre>{message.content}</pre>
                  {message.sources && message.sources.length > 0 ? (
                    <div className="source-list">
                      {message.sources.map((source) => (
                        <SourceCard key={`${source.documentId}-${source.chunkIndex}`} source={source} />
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={submitQuestion}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask an academic question. Example: Explain Dijkstra's algorithm with a worked example in C++."
              />
              <div className="action-row">
                <span className="tiny">
                  {documents.length > 0
                    ? "RAG is active. Answers will use indexed study material when relevant."
                    : "No documents indexed. EduGPT will answer from the configured model only."}
                </span>
                <button className="button" disabled={isChatPending} type="submit">
                  {isChatPending ? "Thinking..." : "Ask EduGPT"}
                </button>
              </div>
              {chatError ? <p className="tiny" style={{ color: "var(--danger)" }}>{chatError}</p> : null}
            </form>
          </div>

          <div className="card panel">
            <h2 className="section-title">Study Material</h2>
            <p className="muted">
              Upload notes, summaries, or PDFs. The app extracts text, chunks the content,
              computes embeddings, and stores a local retrieval index for grounded answers.
            </p>

            <form className="upload-form" onSubmit={submitDocument}>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Document title"
              />
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option>Computer Science</option>
                <option>Mathematics</option>
                <option>Physics</option>
                <option>Engineering</option>
                <option>General</option>
              </select>
              <input
                accept=".txt,.md,.pdf"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <div className="action-row">
                <span className="tiny">
                  Supported now: `.txt`, `.md`, `.pdf`
                </span>
                <button className="button" disabled={isUploadPending} type="submit">
                  {isUploadPending ? "Indexing..." : "Upload and index"}
                </button>
              </div>
              {uploadError ? (
                <p className="tiny" style={{ color: "var(--danger)" }}>
                  {uploadError}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function SourceCard({ source }: { source: SourceReference }) {
  return (
    <div className="source">
      <strong>{source.documentTitle}</strong>
      <div className="tiny">Chunk {source.chunkIndex + 1}</div>
      <div className="tiny">{source.excerpt}...</div>
    </div>
  );
}
