import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeAndCutSource } from "@/lib/trim/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isSupportedSourceUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("soundcloud.com") || lower.startsWith("file://");
}

const analyzeAutoCutSchema = z.object({
  url: z.string().trim().url().refine(isSupportedSourceUrl, "Auto Cut supports one YouTube or SoundCloud URL."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = analyzeAutoCutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid auto-cut payload.");
    }

    const preview = await analyzeAndCutSource(parsed.data.url);
    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze and cut source audio.";
    return errorResponse(message, 500);
  }
}
