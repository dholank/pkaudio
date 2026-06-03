import { NextResponse } from "next/server";
import { listBackups, restoreBackup } from "@/lib/backup/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as { restoreOutputs?: unknown };
    const result = await restoreBackup(id, { restoreOutputs: payload.restoreOutputs === true });
    const backups = await listBackups();
    return NextResponse.json({ restore: result, backups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore backup.";
    const status = message.includes("active job") ? 409 : message.includes("not found") ? 404 : 500;
    return errorResponse(message, status);
  }
}
