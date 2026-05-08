import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultEvaluationDataset, type EvaluationQuestion } from "@/evaluation/datasets";
import { scoreEvaluationResult, type ScoreBreakdown } from "@/evaluation/scorers";
import { run_response_pipeline } from "@/pipelines/response_pipeline";
import { run_retrieval_pipeline } from "@/pipelines/retrieval_pipeline";

export interface EvaluationFailure {
  question: string;
  reason: string;
}

export interface EvaluationQuestionResult {
  question_id: string;
  question: string;
  score: ScoreBreakdown;
  trace_id: string;
}

export interface EvaluationRunResult {
  run_id: string;
  created_at: string;
  total_questions: number;
  average_score: number;
  failures: EvaluationFailure[];
  results: EvaluationQuestionResult[];
}

const logsDirectory = path.join(process.cwd(), "logs");
const evaluationResultsPath = path.join(logsDirectory, "evaluation-results.json");

async function ensureLogsDirectory(): Promise<void> {
  await mkdir(logsDirectory, { recursive: true });
}

async function readStoredResults(): Promise<Record<string, EvaluationRunResult>> {
  await ensureLogsDirectory();

  try {
    return JSON.parse(await readFile(evaluationResultsPath, "utf8")) as Record<string, EvaluationRunResult>;
  } catch {
    return {};
  }
}

async function writeStoredResults(results: Record<string, EvaluationRunResult>): Promise<void> {
  await ensureLogsDirectory();
  await writeFile(evaluationResultsPath, JSON.stringify(results, null, 2), "utf8");
}

async function evaluateQuestion(question: EvaluationQuestion): Promise<EvaluationQuestionResult> {
  const retrievalStartedAt = Date.now();
  const retrieval = await run_retrieval_pipeline({
    query: question.question
  });
  const retrievalLatencyMs = Date.now() - retrievalStartedAt;
  const response = await run_response_pipeline({
    messages: [
      {
        role: "user",
        content: question.question
      }
    ],
    retrieval,
    difficulty: question.difficulty,
    retrievalLatencyMs,
    requestStartedAt: retrievalStartedAt
  });

  return {
    question_id: question.id,
    question: question.question,
    score: scoreEvaluationResult(question, response.message, retrieval),
    trace_id: response.trace_id
  };
}

export async function runEvaluation(dataset = defaultEvaluationDataset): Promise<EvaluationRunResult> {
  const results: EvaluationQuestionResult[] = [];

  for (const question of dataset) {
    results.push(await evaluateQuestion(question));
  }

  const averageScore =
    results.length === 0
      ? 0
      : results.reduce((sum, result) => sum + result.score.total, 0) / results.length;
  const failures = results.flatMap((result) =>
    result.score.failures.map((reason) => ({
      question: result.question,
      reason
    }))
  );
  const run: EvaluationRunResult = {
    run_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    total_questions: results.length,
    average_score: averageScore,
    failures,
    results
  };
  const storedResults = await readStoredResults();
  storedResults[run.run_id] = run;
  await writeStoredResults(storedResults);

  return run;
}

export async function getEvaluationRun(runId: string): Promise<EvaluationRunResult | null> {
  const storedResults = await readStoredResults();
  return storedResults[runId] ?? null;
}
