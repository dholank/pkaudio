import { NextResponse } from "next/server";
import { getJobById, recordRobloxModerationAudit, toJobView } from "@/lib/jobs/repository";
import { auditRobloxAssetModeration } from "@/lib/roblox/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await getJobById(id);
    if (!row) return errorResponse("Job not found.", 404);

    const job = toJobView(row);
    if (!job.credentialId) return errorResponse("This job does not have a Roblox credential attached.");
    if (!job.assetId) return errorResponse("This job has no Roblox asset ID to check.");

    const audit = await auditRobloxAssetModeration({ credentialId: job.credentialId, assetId: job.assetId });
    const updated = await recordRobloxModerationAudit(job.id, audit);
    if (!updated) return errorResponse("Job disappeared while updating Roblox moderation status.", 404);

    return NextResponse.json({ job: updated, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check Roblox moderation status.";
    return errorResponse(message, 500);
  }
}
