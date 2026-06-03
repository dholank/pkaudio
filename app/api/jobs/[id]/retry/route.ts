import { NextResponse } from "next/server";
import { retryJob } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await retryJob(id);

    if (!job) return errorResponse("Job not found.", 404);

    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retry job.";
    return errorResponse(message, 500);
  }
}
