import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { traceRecordSchema, type TraceRecord } from "@/observability/schemas";
import { prisma } from "@/lib/db";

const logsDirectory = path.join(process.cwd(), "logs");
const traceLogPath = path.join(logsDirectory, "traces.jsonl");

async function ensureLogsDirectory(): Promise<void> {
  await mkdir(logsDirectory, { recursive: true });
}

export async function appendTrace(record: TraceRecord): Promise<void> {
  await ensureLogsDirectory();
  const parsed = traceRecordSchema.parse(record);
  await writeFile(traceLogPath, `${JSON.stringify(parsed)}\n`, {
    encoding: "utf8",
    flag: "a"
  });
  await prisma.trace.upsert({
    where: { trace_id: parsed.trace_id },
    update: {
      payload: JSON.stringify(parsed),
      userId: parsed.user_id ?? null
    },
    create: {
      trace_id: parsed.trace_id,
      payload: JSON.stringify(parsed),
      userId: parsed.user_id ?? null
    }
  });
}

export async function readRecentTraces(limit = 50, options: { userId?: string; includeAll?: boolean } = {}): Promise<TraceRecord[]> {
  await ensureLogsDirectory();

  try {
    const dbTraces = await prisma.trace.findMany({
      where: options.includeAll || !options.userId ? undefined : { userId: options.userId },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit, 1)
    });

    if (dbTraces.length > 0) {
      return dbTraces.map((trace) => traceRecordSchema.parse(JSON.parse(trace.payload)));
    }

    const raw = await readFile(traceLogPath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .slice(-Math.max(limit, 1))
      .reverse()
      .map((line) => traceRecordSchema.parse(JSON.parse(line)));
  } catch {
    return [];
  }
}

export async function findTraceById(
  traceId: string,
  options: { userId?: string; includeAll?: boolean } = {}
): Promise<TraceRecord | null> {
  try {
    const trace = await prisma.trace.findFirst({
      where: {
        trace_id: traceId,
        ...(options.includeAll || !options.userId ? {} : { userId: options.userId })
      }
    });

    if (trace) {
      return traceRecordSchema.parse(JSON.parse(trace.payload));
    }
  } catch {
    // Fall through to JSONL lookup for local development traces.
  }

  const traces = await readRecentTraces(Number.MAX_SAFE_INTEGER, options);
  return traces.find((trace) => trace.trace_id === traceId) ?? null;
}
