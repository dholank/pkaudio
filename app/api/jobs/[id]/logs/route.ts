import { NextResponse } from "next/server";
import { getJobById, listJobLogs, toJobView } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await getJobById(id);
    if (!job) return errorResponse("Job not found.", 404);

    const logs = await listJobLogs(id);
    return NextResponse.json({ job: toJobView(job), logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list job logs.";
    return errorResponse(message, 500);
  }
}
