import { NextResponse } from "next/server";
import { getEvaluationRun } from "@/evaluation/runner";

export async function GET(_: Request, context: { params: Promise<{ run_id: string }> }) {
  const { run_id } = await context.params;
  const result = await getEvaluationRun(run_id);

  if (!result) {
    return NextResponse.json({ error: "Evaluation run not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
