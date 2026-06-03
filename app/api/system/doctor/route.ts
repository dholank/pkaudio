import { NextResponse } from "next/server";
import { getLocalDoctorReport } from "@/lib/system/doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const doctor = await getLocalDoctorReport();
    return NextResponse.json({ doctor });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run local doctor." },
      { status: 500 },
    );
  }
}
