import { NextResponse } from "next/server";
import { runEvaluation } from "@/evaluation/runner";

export async function POST() {
  const result = await runEvaluation();

  return NextResponse.json(result);
}
