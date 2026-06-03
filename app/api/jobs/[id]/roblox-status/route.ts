import { NextResponse } from "next/server";
import { getJobById, recordRobloxOperationAudit, toJobView } from "@/lib/jobs/repository";
import { auditRobloxOperation } from "@/lib/roblox/upload";

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
    const operationReference = job.robloxOperationPath ?? job.robloxOperationId;
    if (!operationReference) return errorResponse("This job has no Roblox operation reference to audit.");

    const audit = await auditRobloxOperation({ credentialId: job.credentialId, operationReference });
    const updated = await recordRobloxOperationAudit(job.id, audit);
    if (!updated) return errorResponse("Job disappeared while updating Roblox audit status.", 404);

    return NextResponse.json({ job: updated, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to audit Roblox operation.";
    return errorResponse(message, 500);
  }
}
