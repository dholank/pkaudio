import { NextResponse } from "next/server";
import { getWorkerHealthStatus } from "@/lib/worker/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const status = await getWorkerHealthStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read worker status.";
    return errorResponse(message, 500);
  }
}
