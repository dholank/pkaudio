import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { WaveformAnalysis } from "@/lib/audio/waveform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isInside(root: string, target: string) {
  return target === root || target.startsWith(root + path.sep);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { path: segments } = await context.params;
    if (!segments.length) return errorResponse("Missing waveform path.", 400);

    const outputRoot = path.resolve(process.cwd(), "outputs");
    const outputPath = path.resolve(outputRoot, ...segments);

    if (outputPath === outputRoot || !isInside(outputRoot, outputPath)) {
      return errorResponse("Invalid waveform path.", 400);
    }

    const waveformPath = `${outputPath}.waveform.json`;
    if (!isInside(outputRoot, waveformPath)) {
      return errorResponse("Invalid waveform artifact path.", 400);
    }

    let content: string;
    try {
      content = await fs.readFile(waveformPath, "utf8");
    } catch {
      return errorResponse("Waveform artifact not found. Reprocess this audio with the worker to generate it.", 404);
    }

    const parsed = JSON.parse(content) as WaveformAnalysis;
    return NextResponse.json(parsed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read waveform artifact.";
    return errorResponse(message, 500);
  }
}
