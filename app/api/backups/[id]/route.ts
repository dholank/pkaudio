import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { deleteBackup, getBackup } from "@/lib/backup/local";

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
    const backup = await getBackup(id);
    if (!backup.exists) return errorResponse("Backup archive not found.", 404);
    const stat = fs.statSync(backup.archivePath);
    const filename = path.basename(backup.archivePath).replaceAll('"', "'");
    const stream = fs.createReadStream(backup.archivePath);

    return new Response(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download backup.";
    return errorResponse(message, message.includes("not found") ? 404 : 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const backup = await deleteBackup(id);
    return NextResponse.json({ backup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete backup.";
    return errorResponse(message, message.includes("not found") ? 404 : 500);
  }
}
