import { NextResponse } from "next/server";
import { listChatSessions } from "@/lib/chat_history";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const chats = await listChatSessions(user.id);

    return NextResponse.json({ chats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chats.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
