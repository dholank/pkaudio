import { NextResponse } from "next/server";
import { recoverStaleJobs } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { maxAgeMs?: unknown; failUploading?: unknown };
    const maxAgeMs = typeof payload.maxAgeMs === "number" && Number.isFinite(payload.maxAgeMs) ? payload.maxAgeMs : undefined;
    const failUploading = typeof payload.failUploading === "boolean" ? payload.failUploading : undefined;

    const recovery = await recoverStaleJobs({ maxAgeMs, failUploading });
    return NextResponse.json({ recovery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to recover stale jobs.";
    return errorResponse(message, 500);
  }
}
