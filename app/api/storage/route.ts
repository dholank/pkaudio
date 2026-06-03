import { NextResponse } from "next/server";
import { cleanupStorage, getStorageStats } from "@/lib/storage/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseTarget(value: unknown): "temp" | "outputs" | "all" {
  if (value === "temp" || value === "outputs" || value === "all") return value;
  throw new Error("Cleanup target must be temp, outputs, or all.");
}

function parseMaxAgeMs(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("maxAgeMs must be a non-negative number or null.");
  }
  return value;
}

export async function GET() {
  try {
    const storage = await getStorageStats();
    return NextResponse.json({ storage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read storage stats.";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { target?: unknown; maxAgeMs?: unknown };
    const target = parseTarget(payload.target ?? "temp");
    const maxAgeMs = parseMaxAgeMs(payload.maxAgeMs);
    const cleanup = await cleanupStorage({ target, maxAgeMs });
    const storage = await getStorageStats();

    return NextResponse.json({ cleanup, storage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run cleanup.";
    return errorResponse(message, 500);
  }
}
