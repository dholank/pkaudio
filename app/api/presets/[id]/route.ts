import { NextResponse } from "next/server";
import { deleteAudioPreset, updateAudioPreset } from "@/lib/presets/repository";
import { audioPresetPatchSchema } from "@/lib/presets/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = audioPresetPatchSchema.parse(await request.json());
    const preset = await updateAudioPreset(id, payload);
    if (!preset) return errorResponse("Preset not found.", 404);
    return NextResponse.json({ preset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update preset.";
    return errorResponse(message);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preset = await deleteAudioPreset(id);
  if (!preset) return errorResponse("Preset not found.", 404);
  return NextResponse.json({ preset });
}
