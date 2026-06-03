import { NextResponse } from "next/server";
import { deleteJob, getJobById, toJobView } from "@/lib/jobs/repository";

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
    const row = await getJobById(id);
    if (!row) return errorResponse("Job not found.", 404);

    return NextResponse.json({ job: toJobView(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job.";
    return errorResponse(message, 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const deleteArtifacts = searchParams.get("deleteArtifacts") !== "false";

    const result = await deleteJob(id, { deleteArtifacts });
    if (!result) return errorResponse("Job not found.", 404);

    return NextResponse.json({ deleted: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete job.";
    return errorResponse(message, 500);
  }
}
