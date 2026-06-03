import { NextResponse } from "next/server";
import { getDatabaseInfo, getSqlite } from "@/lib/db/client";
import { getSystemChecks } from "@/lib/system/checks";
import { getLocalDoctorReport } from "@/lib/system/doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getSqlite();
    const [binaries, doctor] = await Promise.all([getSystemChecks(), getLocalDoctorReport()]);

    return NextResponse.json({
      database: {
        status: "ok",
        path: getDatabaseInfo().path,
        tables: ["credentials", "batches", "jobs", "job_logs", "worker_heartbeats", "settings", "audio_presets"],
      },
      encryption: {
        status: process.env.ENCRYPTION_MASTER_KEY ? "configured" : "missing",
        algorithm: "AES-256-GCM",
      },
      binaries,
      worker: {
        status: Object.values(binaries).every((binary) => binary.ok) ? "ready" : "missing_dependencies",
        command: "npm run worker",
        onceCommand: "npm run worker:once",
      },
      doctor,
      phase: "20-final-qa-polish",
    });
  } catch (error) {
    return NextResponse.json(
      {
        database: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown database error.",
        },
        phase: "20-final-qa-polish",
      },
      { status: 500 },
    );
  }
}
