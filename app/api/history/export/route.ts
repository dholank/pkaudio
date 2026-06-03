import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs/repository";
import { exportJobsQuerySchema } from "@/lib/jobs/validation";
import type { JobView } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const columns: Array<{ key: string; label: string; value: (job: JobView) => string | number | boolean | null }> = [
  { key: "id", label: "Job ID", value: (job) => job.id },
  { key: "batchId", label: "Batch ID", value: (job) => job.batchId },
  { key: "sourceUrl", label: "Source URL", value: (job) => job.sourceUrl },
  { key: "sourcePlatform", label: "Platform", value: (job) => job.sourcePlatform },
  { key: "title", label: "Title", value: (job) => job.title },
  { key: "status", label: "Status", value: (job) => job.status },
  { key: "attemptCount", label: "Attempt Count", value: (job) => job.attemptCount },
  { key: "maxAttempts", label: "Max Attempts", value: (job) => job.maxAttempts },
  { key: "speed", label: "Speed", value: (job) => job.speed },
  { key: "amplifyDb", label: "Amplify dB", value: (job) => job.amplifyDb },
  { key: "quality", label: "Quality", value: (job) => job.quality },
  { key: "audioSafetyMode", label: "Audio Safety Mode", value: (job) => job.audioSafetyMode },
  { key: "headroomDb", label: "Headroom dBFS", value: (job) => job.headroomDb },
  { key: "limiterEnabled", label: "Limiter", value: (job) => job.limiterEnabled },
  { key: "uploadEnabled", label: "Upload Enabled", value: (job) => job.uploadEnabled },
  { key: "credentialName", label: "Credential", value: (job) => job.credentialName },
  { key: "outputPath", label: "Output Path", value: (job) => job.outputPath },
  { key: "duration", label: "Duration Sec", value: (job) => job.outputDurationSec },
  { key: "size", label: "Size Bytes", value: (job) => job.outputSizeBytes },
  { key: "peak", label: "Peak dBFS", value: (job) => job.outputPeakDb },
  { key: "mean", label: "Mean dB", value: (job) => job.outputMeanDb },
  { key: "sampleRate", label: "Sample Rate", value: (job) => job.outputSampleRate },
  { key: "channels", label: "Channels", value: (job) => job.outputChannels },
  { key: "assetId", label: "Roblox Asset ID", value: (job) => job.assetId },
  { key: "robloxOperationId", label: "Roblox Operation ID", value: (job) => job.robloxOperationId },
  { key: "robloxOperationStatus", label: "Roblox Operation Status", value: (job) => job.robloxOperationStatus },
  { key: "robloxOperationCheckedAt", label: "Roblox Operation Checked At", value: (job) => job.robloxOperationCheckedAt },
  { key: "robloxModerationState", label: "Roblox Moderation State", value: (job) => job.robloxModerationState },
  { key: "robloxModerationCheckedAt", label: "Roblox Moderation Checked At", value: (job) => job.robloxModerationCheckedAt },
  { key: "robloxModerationAttemptCount", label: "Roblox Moderation Check Count", value: (job) => job.robloxModerationAttemptCount },
  { key: "error", label: "Error", value: (job) => job.error },
  { key: "createdAt", label: "Created At", value: (job) => job.createdAt },
  { key: "updatedAt", label: "Updated At", value: (job) => job.updatedAt },
];

function csvCell(value: string | number | boolean | null) {
  if (value === null) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(jobs: JobView[]) {
  const lines = [columns.map((column) => csvCell(column.label)).join(",")];
  for (const job of jobs) {
    lines.push(columns.map((column) => csvCell(column.value(job))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = exportJobsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid export query.");

    const { format, ...filters } = parsed.data;
    const jobs = await listJobs({ ...filters, limit: filters.limit ?? 1000 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: jobs.length, jobs }, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="pkaudio-history-${timestamp}.json"`,
        },
      });
    }

    return new NextResponse(toCsv(jobs), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pkaudio-history-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export history.";
    return errorResponse(message, 500);
  }
}
