import { NextResponse } from "next/server";
import { createBatch, listBatches } from "@/lib/jobs/repository";
import { createBatchSchema } from "@/lib/jobs/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const batches = await listBatches();
    return NextResponse.json({ batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list batches.";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createBatchSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid batch payload.");
    }

    const result = await createBatch(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create batch.";
    return errorResponse(message, 500);
  }
}
