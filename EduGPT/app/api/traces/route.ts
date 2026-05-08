import { NextResponse } from "next/server";
import { readRecentTraces } from "@/observability/trace_store";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const traces = await readRecentTraces(Number.isFinite(limit) ? limit : 50, {
      userId: user.id,
      includeAll: user.role === "ADMIN"
    });

    return NextResponse.json({ traces });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load traces.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
