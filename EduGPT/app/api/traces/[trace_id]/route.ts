import { NextResponse } from "next/server";
import { findTraceById } from "@/observability/trace_store";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: Request, context: { params: Promise<{ trace_id: string }> }) {
  try {
    const user = await requireUser(request);
    const { trace_id } = await context.params;
    const trace = await findTraceById(trace_id, {
      userId: user.id,
      includeAll: user.role === "ADMIN"
    });

    if (!trace) {
      return NextResponse.json({ error: "Trace not found." }, { status: 404 });
    }

    return NextResponse.json({ trace });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load trace.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
