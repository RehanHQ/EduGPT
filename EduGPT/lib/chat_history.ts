import { prisma } from "@/lib/db";
import type { ChatMessage } from "@/lib/types";

export async function ensureChatSession(input: {
  sessionId?: string;
  userId: string;
  organizationId: string;
  titleSeed: string;
}) {
  if (input.sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId
      }
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.chatSession.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      title: input.titleSeed.slice(0, 80) || "New chat"
    }
  });
}

export async function persistChatExchange(input: {
  userId: string;
  sessionId: string;
  userContent: string;
  assistantMessage: ChatMessage;
}) {
  await prisma.chatMessage.createMany({
    data: [
      {
        userId: input.userId,
        sessionId: input.sessionId,
        role: "user",
        content: input.userContent
      },
      {
        userId: input.userId,
        sessionId: input.sessionId,
        role: "assistant",
        content: input.assistantMessage.content,
        structuredResponse: input.assistantMessage.structuredResponse
          ? JSON.stringify(input.assistantMessage.structuredResponse)
          : null,
        sources: input.assistantMessage.sources ? JSON.stringify(input.assistantMessage.sources) : null,
        difficulty: input.assistantMessage.difficulty ?? null,
        traceId: input.assistantMessage.traceId ?? null
      }
    ]
  });
}

function parseJsonValue<T>(value: string | null): T | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export async function listChatSessions(userId: string) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getChatSession(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      structuredResponse: parseJsonValue(message.structuredResponse),
      sources: parseJsonValue(message.sources),
      difficulty:
        message.difficulty === "Beginner" || message.difficulty === "Intermediate" || message.difficulty === "Advanced"
          ? message.difficulty
          : undefined,
      traceId: message.traceId ?? undefined,
      sessionId: session.id
    }))
  };
}

export async function deleteChatSession(userId: string, sessionId: string) {
  await prisma.chatSession.deleteMany({
    where: {
      id: sessionId,
      userId
    }
  });
}
