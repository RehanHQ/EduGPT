import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { run_response_pipeline } from "@/pipelines/response_pipeline";
import { run_retrieval_pipeline } from "@/pipelines/retrieval_pipeline";
import { elapsedMs, nowMs } from "@/observability/logger";
import { ensureChatSession, persistChatExchange } from "@/lib/chat_history";
import { requireUser } from "@/lib/auth/session";

const incomingRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })
  ),
  chatSessionId: z.string().optional(),
  stream: z.boolean().optional(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional()
});

const normalizedRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1, "Message content cannot be empty.")
    })
  ).min(1, "At least one message is required."),
  chatSessionId: z.string().optional(),
  stream: z.boolean().optional(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional()
});

function createChatStream(payload: unknown): Response {
  const encodedPayload = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const finalPayload = payload as { message?: { content?: string } };
      const words = (finalPayload.message?.content ?? "").split(/\s+/).filter(Boolean);

      for (const word of words) {
        controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ token: `${word} ` })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      controller.enqueue(encoder.encode(`event: final\ndata: ${encodedPayload}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

export async function POST(request: Request) {
  try {
    const requestStartedAt = nowMs();
    const user = await requireUser(request);
    const incomingPayload = incomingRequestSchema.parse(await request.json());
    const payload = normalizedRequestSchema.parse({
      ...incomingPayload,
      messages: incomingPayload.messages
        .map((message) => ({
          role: message.role,
          content: message.content.trim()
        }))
        .filter((message) => message.content.length > 0)
    });
    const latestUserMessage = [...payload.messages].reverse().find((message) => message.role === "user");

    if (!latestUserMessage) {
      return NextResponse.json({ error: "A user question is required." }, { status: 400 });
    }

    const retrievalStartedAt = nowMs();
    const retrieval = await run_retrieval_pipeline({
      query: latestUserMessage.content,
      organizationId: user.organizationId
    });
    const retrievalLatencyMs = elapsedMs(retrievalStartedAt);
    const session = await ensureChatSession({
      sessionId: payload.chatSessionId,
      userId: user.id,
      organizationId: user.organizationId,
      titleSeed: latestUserMessage.content
    });
    const { message, trace_id } = await run_response_pipeline({
      messages: payload.messages,
      retrieval,
      difficulty: payload.difficulty,
      retrievalLatencyMs,
      requestStartedAt,
      userId: user.id
    });
    const messageWithSession = {
      ...message,
      sessionId: session.id
    };

    await persistChatExchange({
      userId: user.id,
      sessionId: session.id,
      userContent: latestUserMessage.content,
      assistantMessage: messageWithSession
    });

    const responsePayload = { message: messageWithSession, trace_id, chatSessionId: session.id };

    if (payload.stream) {
      return createChatStream(responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid chat request payload.",
          details: error.flatten()
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown server error.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
