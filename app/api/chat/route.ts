import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTutorReply } from "@/lib/ai";
import { buildUserPrompt, tutorSystemPrompt } from "@/lib/prompt";
import { buildContextFromMatches, mapMatchesToSources, retrieveRelevantChunks } from "@/lib/rag";
import { readDocumentIndex } from "@/lib/storage";
import type { ChatMessage } from "@/lib/types";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1)
    })
  )
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const latestUserMessage = [...payload.messages].reverse().find((message) => message.role === "user");

    if (!latestUserMessage) {
      return NextResponse.json({ error: "A user question is required." }, { status: 400 });
    }

    const index = await readDocumentIndex();
    const matches = await retrieveRelevantChunks(index.chunks, latestUserMessage.content);
    const context = buildContextFromMatches(matches);
    const text = await generateTutorReply(
      payload.messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.role === "user" ? buildUserPrompt(message.content, context) : message.content
      })),
      tutorSystemPrompt
    );

    if (!text) {
      return NextResponse.json({ error: "The model returned an empty response." }, { status: 502 });
    }

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: text,
      createdAt: new Date().toISOString(),
      sources: mapMatchesToSources(matches)
    };

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
