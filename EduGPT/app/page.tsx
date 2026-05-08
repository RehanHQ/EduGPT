"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import type { ChatMessage, SourceReference, StoredDocument, StructuredTutorResponse } from "@/lib/types";

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organization: {
    name: string;
    domain: string;
  };
}

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface EvaluationFailure {
  question: string;
  reason: string;
}

interface EvaluationRunResult {
  run_id: string;
  total_questions: number;
  average_score: number;
  failures: EvaluationFailure[];
}

const starterMessage: ChatMessage = {
  id: "starter",
  role: "assistant",
  createdAt: "2026-04-19T00:00:00.000Z",
  content: "EduGPT is ready to answer with structured, grounded tutoring responses.",
  structuredResponse: {
    explanation: "Start a new question or open a previous chat from the sidebar.",
    example: "Ask: Explain recursion using my uploaded notes.",
    key_points: ["Teacher uploads are organization-scoped.", "Student chats are isolated per user.", "Sources and traces appear in the right panel."],
    grounded: false,
    fallback_reason: null
  }
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

function latestAssistantMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant" && message.id !== "starter");
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginEmail, setLoginEmail] = useState("teacher@example.edu");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [file, setFile] = useState<File | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationRunResult | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isChatPending, startChatTransition] = useTransition();
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isEvaluationPending, startEvaluationTransition] = useTransition();
  const canSendQuestion = question.trim().length > 0 && !isChatPending && Boolean(user);
  const canUpload = user?.role === "TEACHER" || user?.role === "ADMIN";
  const activeAssistant = useMemo(() => latestAssistantMessage(messages), [messages]);
  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunkCount, 0),
    [documents]
  );

  useEffect(() => {
    void loadMe();
  }, []);

  useEffect(() => {
    if (user) {
      void refreshWorkspace();
    }
  }, [user]);

  async function loadMe() {
    const data = await parseJson<{ user: AuthUser | null }>(await fetch("/api/auth/me"));
    setUser(data.user);
  }

  async function refreshWorkspace() {
    await Promise.all([loadDocuments(), loadChats()]);
  }

  async function loadDocuments() {
    const data = await parseJson<{ documents: StoredDocument[] }>(await fetch("/api/documents"));
    setDocuments(data.documents);
  }

  async function loadChats() {
    const data = await parseJson<{ chats: ChatSummary[] }>(await fetch("/api/chats"));
    setChats(data.chats);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    try {
      const data = await parseJson<{ user: AuthUser }>(
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail })
        })
      );
      setUser(data.user);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setChats([]);
    setDocuments([]);
    setActiveChatId(null);
    setMessages([starterMessage]);
  }

  async function openChat(chatId: string) {
    const data = await parseJson<{ chat: { id: string; messages: ChatMessage[] } }>(
      await fetch(`/api/chats/${chatId}`)
    );
    setActiveChatId(data.chat.id);
    setMessages(data.chat.messages.length > 0 ? data.chat.messages : [starterMessage]);
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([starterMessage]);
    setChatError(null);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || !user) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
      createdAt: new Date().toISOString()
    };
    const assistantDraftId = crypto.randomUUID();
    const assistantDraft: ChatMessage = {
      id: assistantDraftId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };
    const nextMessages = messages.concat(userMessage);

    setMessages(nextMessages.concat(assistantDraft));
    setQuestion("");
    setChatError(null);

    startChatTransition(async () => {
      try {
        const outboundMessages = nextMessages
          .map(({ role, content }) => ({ role, content: content.trim() }))
          .filter((message) => message.content.length > 0);
        const payload = {
          messages: outboundMessages,
          difficulty,
          chatSessionId: activeChatId ?? undefined,
          stream: true
        };

        if (process.env.NODE_ENV !== "production") {
          console.debug("POST /api/chat payload", payload);
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok || !response.body) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? "Unable to answer right now.");
        }

        await readChatStream(response, assistantDraftId);
        await loadChats();
      } catch (error) {
        setMessages((current) => current.filter((message) => message.id !== assistantDraftId));
        setChatError(error instanceof Error ? error.message : "Unable to answer right now.");
      }
    });
  }

  async function readChatStream(response: Response, draftId: string) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) {
      return;
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const eventBlock of events) {
        const event = parseStreamEvent(eventBlock);

        if (event.name === "token") {
          const data = JSON.parse(event.data) as { token: string };
          setMessages((current) =>
            current.map((message) =>
              message.id === draftId ? { ...message, content: `${message.content}${data.token}` } : message
            )
          );
        }

        if (event.name === "final") {
          const data = JSON.parse(event.data) as { message: ChatMessage; trace_id?: string; chatSessionId?: string };
          setActiveChatId(data.chatSessionId ?? null);
          setMessages((current) =>
            current.map((message) =>
              message.id === draftId
                ? {
                    ...data.message,
                    traceId: data.message.traceId ?? data.trace_id
                  }
                : message
            )
          );
        }
      }
    }
  }

  function parseStreamEvent(block: string) {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));

    return {
      name: eventLine?.replace("event:", "").trim() ?? "message",
      data: dataLine?.replace("data:", "").trim() ?? "{}"
    };
  }

  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !file || !canUpload) {
      setUploadError(canUpload ? "Add a document title and choose a file before uploading." : "Teacher role required.");
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
        setUploadError(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  function runEvaluation() {
    setEvaluationError(null);

    startEvaluationTransition(async () => {
      try {
        const result = await parseJson<EvaluationRunResult>(
          await fetch("/api/evaluation/run", {
            method: "POST"
          })
        );
        setEvaluationResult(result);
      } catch (error) {
        setEvaluationError(error instanceof Error ? error.message : "Evaluation failed.");
      }
    });
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <h1>EduGPT</h1>
          <p>Sign in with your college email to join your organization workspace.</p>
          <form className="login-form" onSubmit={login}>
            <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} type="email" />
            <button className="button" type="submit">Continue</button>
          </form>
          {loginError ? <p className="error-text">{loginError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={rightPanelOpen ? "app-shell" : "app-shell right-closed"}>
      <aside className="left-rail">
        <div className="brand-block">
          <h1>EduGPT</h1>
          <p>{user.organization.domain}</p>
          <span>{user.role}</span>
        </div>
        <button className="button full" onClick={newChat} type="button">New chat</button>
        <div className="chat-list">
          {chats.map((chat) => (
            <button
              className={activeChatId === chat.id ? "chat-list-item active" : "chat-list-item"}
              key={chat.id}
              onClick={() => void openChat(chat.id)}
              type="button"
            >
              <span>{chat.title}</span>
              <small>{formatDate(chat.updatedAt)}</small>
            </button>
          ))}
        </div>
        <button className="ghost-button full" onClick={() => void logout()} type="button">Sign out</button>
      </aside>

      <section className="chat-stage">
        <header className="top-bar">
          <div>
            <h2>{activeChatId ? "Chat session" : "New tutoring chat"}</h2>
            <p>{documents.length} documents, {totalChunks} chunks available</p>
          </div>
          <button className="ghost-button" onClick={() => setRightPanelOpen((open) => !open)} type="button">
            {rightPanelOpen ? "Hide panel" : "Show panel"}
          </button>
        </header>

        <div className="message-stream">
          {messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="message-meta">
                <span>{message.role === "assistant" ? "EduGPT" : "You"}</span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              {message.role === "assistant" ? <AssistantMessage message={message} /> : <p>{message.content}</p>}
            </article>
          ))}
          {chatError ? <p className="error-text">{chatError}</p> : null}
        </div>

        <form className="composer-bar" onSubmit={submitQuestion}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question from your organization notes..."
          />
          <div className="composer-actions">
            <div className="segmented-control" aria-label="Difficulty">
              {(["Beginner", "Intermediate", "Advanced"] as const).map((level) => (
                <button
                  className={difficulty === level ? "segment active" : "segment"}
                  key={level}
                  onClick={() => setDifficulty(level)}
                  type="button"
                >
                  {level}
                </button>
              ))}
            </div>
            <button className="button" disabled={!canSendQuestion} type="submit">
              {isChatPending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      {rightPanelOpen ? (
        <aside className="right-panel">
          <SourcesPanel message={activeAssistant} />
          <UploadPanel
            canUpload={canUpload}
            file={file}
            isUploadPending={isUploadPending}
            onSubmit={submitDocument}
            setFile={setFile}
            setSubject={setSubject}
            setTitle={setTitle}
            subject={subject}
            title={title}
            uploadError={uploadError}
          />
          <EvaluationPanel
            evaluationError={evaluationError}
            isEvaluationPending={isEvaluationPending}
            result={evaluationResult}
            runEvaluation={runEvaluation}
          />
        </aside>
      ) : null}
    </main>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const response = message.structuredResponse;

  if (!response) {
    return <p className="streaming-text">{message.content || "Thinking..."}</p>;
  }

  return (
    <div className="structured-response">
      <ResponseSection title="Explanation">{response.explanation}</ResponseSection>
      <ResponseSection title="Example">{response.example}</ResponseSection>
      <div className="response-section">
        <h3>Key Points</h3>
        <ul>
          {response.key_points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <TracePanel message={message} response={response} />
    </div>
  );
}

function ResponseSection({ children, title }: { children: string; title: string }) {
  return (
    <div className="response-section">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function TracePanel({ message, response }: { message: ChatMessage; response: StructuredTutorResponse }) {
  const steps = response.fallback_reason
    ? ["Checked organization documents", response.fallback_reason]
    : ["Retrieved organization-scoped chunks", "Generated structured tutor response", "Stored trace and chat message"];

  return (
    <details className="trace-panel">
      <summary>View reasoning steps</summary>
      <div className="trace-grid">
        <span>Trace ID</span>
        <strong>{message.traceId ?? "Not available"}</strong>
        <span>Sources</span>
        <strong>{message.sources?.length ?? 0}</strong>
        <span>Grounded</span>
        <strong>{response.grounded ? "Yes" : "No"}</strong>
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}

function SourcesPanel({ message }: { message?: ChatMessage }) {
  const sources = message?.sources ?? [];

  return (
    <section className="panel-section">
      <h3>Sources</h3>
      {sources.length === 0 ? <p className="muted">No retrieved sources for the latest answer.</p> : null}
      <div className="source-list">
        {sources.map((source) => (
          <SourceCard key={`${source.documentId}-${source.chunkIndex}`} source={source} />
        ))}
      </div>
    </section>
  );
}

function SourceCard({ source }: { source: SourceReference }) {
  return (
    <div className="source">
      <strong>{source.documentTitle}</strong>
      <div className="source-meta">
        <span>{source.sectionTitle ?? "Untitled section"}</span>
        <span>{source.pageNumber ? `Page ${source.pageNumber}` : "Page N/A"}</span>
        <span>Chunk {source.chunkIndex + 1}</span>
      </div>
      <p>{source.excerpt}...</p>
    </div>
  );
}

function UploadPanel(props: {
  canUpload: boolean;
  file: File | null;
  isUploadPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setFile: (file: File | null) => void;
  setSubject: (subject: string) => void;
  setTitle: (title: string) => void;
  subject: string;
  title: string;
  uploadError: string | null;
}) {
  return (
    <section className="panel-section">
      <h3>Documents</h3>
      {!props.canUpload ? <p className="muted">Teacher or admin role required for uploads.</p> : null}
      <form className="upload-form" onSubmit={props.onSubmit}>
        <input
          disabled={!props.canUpload}
          onChange={(event) => props.setTitle(event.target.value)}
          placeholder="Document title"
          type="text"
          value={props.title}
        />
        <select disabled={!props.canUpload} value={props.subject} onChange={(event) => props.setSubject(event.target.value)}>
          <option>Computer Science</option>
          <option>Mathematics</option>
          <option>Physics</option>
          <option>Engineering</option>
          <option>General</option>
        </select>
        <input
          accept=".txt,.md,.pdf"
          disabled={!props.canUpload}
          type="file"
          onChange={(event) => props.setFile(event.target.files?.[0] ?? null)}
        />
        <button className="button full" disabled={!props.canUpload || !props.file || props.isUploadPending} type="submit">
          {props.isUploadPending ? "Uploading..." : "Upload"}
        </button>
      </form>
      {props.uploadError ? <p className="error-text">{props.uploadError}</p> : null}
    </section>
  );
}

function EvaluationPanel(props: {
  evaluationError: string | null;
  isEvaluationPending: boolean;
  result: EvaluationRunResult | null;
  runEvaluation: () => void;
}) {
  return (
    <section className="panel-section">
      <h3>Evaluation</h3>
      <button className="ghost-button full" disabled={props.isEvaluationPending} onClick={props.runEvaluation} type="button">
        {props.isEvaluationPending ? "Running..." : "Run evaluation"}
      </button>
      {props.result ? <EvaluationSummary result={props.result} /> : null}
      {props.evaluationError ? <p className="error-text">{props.evaluationError}</p> : null}
    </section>
  );
}

function EvaluationSummary({ result }: { result: EvaluationRunResult }) {
  return (
    <div className="evaluation-result">
      <div className="score-line">
        <span>Average</span>
        <strong>{Math.round(result.average_score * 100)}%</strong>
      </div>
      <p className="muted">{result.total_questions} questions checked.</p>
      {result.failures.slice(0, 4).map((failure) => (
        <div className="failure-item" key={`${failure.question}-${failure.reason}`}>
          <strong>{failure.question}</strong>
          <span>{failure.reason}</span>
        </div>
      ))}
    </div>
  );
}
