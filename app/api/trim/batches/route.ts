import { NextResponse } from "next/server";
import { createTrimBatch } from "@/lib/jobs/repository";
import { createTrimBatchSchema } from "@/lib/jobs/validation";
import { loadAutoCutManifest, toPublicAutoCutPreview } from "@/lib/trim/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createTrimBatchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid trim batch payload.");
    }

    const manifest = await loadAutoCutManifest(parsed.data.previewId);
    const result = await createTrimBatch({
      sourceUrl: manifest.sourceUrl,
      sourceTitle: manifest.sourceTitle,
      speed: parsed.data.speed,
      amplifyDb: parsed.data.amplifyDb,
      targetLufs: parsed.data.targetLufs,
      quality: parsed.data.quality,
      audioSafetyMode: parsed.data.audioSafetyMode,
      headroomDb: parsed.data.headroomDb,
      limiterEnabled: parsed.data.limiterEnabled,
      uploadEnabled: parsed.data.uploadEnabled,
      credentialId: parsed.data.credentialId,
      assetNamePattern: parsed.data.assetNamePattern,
      parts: manifest.parts.map((part) => ({
        index: part.index,
        total: part.total,
        startSec: part.startSec,
        durationSec: part.durationSec,
        sourceLocalPath: part.sourceLocalPath,
        title: part.title,
      })),
    });

    return NextResponse.json({ ...result, preview: toPublicAutoCutPreview(manifest) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create trim batch.";
    return errorResponse(message, 500);
  }
}
