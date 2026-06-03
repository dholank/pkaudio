import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseRange(range: string | null, size: number) {
  if (!range) return null;
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { path: segments } = await context.params;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "1";
    const outputRoot = path.resolve(process.cwd(), "outputs");
    const targetPath = path.resolve(outputRoot, ...segments);

    if (!targetPath.startsWith(outputRoot + path.sep)) {
      return errorResponse("Invalid output path.", 400);
    }

    if (!fs.existsSync(targetPath)) {
      return errorResponse("Output file not found.", 404);
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isFile()) return errorResponse("Output path is not a file.", 404);

    const range = parseRange(request.headers.get("range"), stat.size);
    const filename = path.basename(targetPath).replaceAll('"', "'");
    const baseHeaders = {
      "Content-Type": "audio/ogg",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    };

    if (range) {
      const stream = fs.createReadStream(targetPath, { start: range.start, end: range.end });
      return new Response(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
        },
      });
    }

    const stream = fs.createReadStream(targetPath);
    return new Response(stream as unknown as BodyInit, {
      headers: {
        ...baseHeaders,
        "Content-Length": String(stat.size),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read output file.";
    return errorResponse(message, 500);
  }
}
