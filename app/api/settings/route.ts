import { NextResponse } from "next/server";
import { getSettings, resetSettings, updateSettings } from "@/lib/settings/repository";
import { settingsPatchSchema } from "@/lib/settings/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const parsed = settingsPatchSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid settings payload.");
    }

    const settings = await updateSettings(parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return errorResponse(message, 500);
  }
}

export async function POST() {
  try {
    const settings = await resetSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset settings.";
    return errorResponse(message, 500);
  }
}
