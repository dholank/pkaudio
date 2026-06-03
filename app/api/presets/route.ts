import { NextResponse } from "next/server";
import { createAudioPreset, listAudioPresets } from "@/lib/presets/repository";
import { audioPresetPayloadSchema } from "@/lib/presets/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const presets = await listAudioPresets();
  return NextResponse.json({ presets });
}

export async function POST(request: Request) {
  try {
    const payload = audioPresetPayloadSchema.parse(await request.json());
    const preset = await createAudioPreset(payload);
    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create preset.";
    return errorResponse(message);
  }
}
