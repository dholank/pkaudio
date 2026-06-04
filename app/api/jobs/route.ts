import { NextResponse } from "next/server";
import { getJobStats, listJobs, listLatestBatchJobs } from "@/lib/jobs/repository";
import { listJobsQuerySchema } from "@/lib/jobs/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listJobsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid jobs query.");
    }

    const latestOnly = parsed.data.scope === "latest";
    const result = latestOnly ? await listLatestBatchJobs(parsed.data) : { batch: null, jobs: await listJobs(parsed.data) };
    const stats = await getJobStats();
    return NextResponse.json({ jobs: result.jobs, batch: result.batch, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list jobs.";
    return errorResponse(message, 500);
  }
}
