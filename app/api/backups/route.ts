import { NextResponse } from "next/server";
import { createBackup, listBackups, type BackupMode } from "@/lib/backup/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseMode(value: unknown): BackupMode {
  if (value === "db" || value === "full") return value;
  throw new Error("Backup mode must be db or full.");
}

export async function GET() {
  try {
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list backups.";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { mode?: unknown; label?: unknown };
    const backup = await createBackup({
      mode: parseMode(payload.mode ?? "db"),
      label: typeof payload.label === "string" ? payload.label : null,
    });
    const backups = await listBackups();
    return NextResponse.json({ backup, backups }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create backup.";
    return errorResponse(message, 500);
  }
}
