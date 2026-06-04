import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { runCommand } from "@/lib/system/command";
import { probeAudio } from "@/lib/worker/media";
import { DEFAULT_TRIM_SEGMENT_SEC, formatDurationClock, formatTrimPartTitle, planFixedTrimSegments } from "@/lib/trim/auto-cut";

type YtdlpInfo = {
  title?: string;
  duration?: number;
  ext?: string;
};

export type AutoCutPreviewPart = {
  index: number;
  total: number;
  startSec: number;
  durationSec: number;
  startLabel: string;
  durationLabel: string;
  title: string;
};

export type AutoCutPreview = {
  previewId: string;
  sourceUrl: string;
  sourceTitle: string | null;
  durationSec: number;
  durationLabel: string;
  segmentSec: number;
  createdAt: string;
  parts: AutoCutPreviewPart[];
};

export type AutoCutManifestPart = AutoCutPreviewPart & {
  sourceLocalPath: string;
};

export type AutoCutManifest = Omit<AutoCutPreview, "parts"> & {
  sourcePath: string;
  parts: AutoCutManifestPart[];
};

const cwd = process.cwd();
const autoCutRoot = path.join(cwd, "tmp", "autocut");

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function safeTitle(title: string | null | undefined) {
  return (title ?? "audio")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "audio";
}

function localSourcePath(sourceUrl: string) {
  if (sourceUrl.startsWith("file://")) return fileURLToPath(sourceUrl);
  if (path.isAbsolute(sourceUrl)) return sourceUrl;
  return null;
}

function manifestPath(previewId: string) {
  return path.join(autoCutRoot, previewId, "manifest.json");
}

function publicPreview(manifest: AutoCutManifest): AutoCutPreview {
  return {
    previewId: manifest.previewId,
    sourceUrl: manifest.sourceUrl,
    sourceTitle: manifest.sourceTitle,
    durationSec: manifest.durationSec,
    durationLabel: manifest.durationLabel,
    segmentSec: manifest.segmentSec,
    createdAt: manifest.createdAt,
    parts: manifest.parts.map(({ sourceLocalPath: _sourceLocalPath, ...part }) => part),
  };
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function getSourceInfo(sourceUrl: string) {
  const local = localSourcePath(sourceUrl);
  if (local) {
    if (!(await fileExists(local))) throw new Error(`Local source file does not exist: ${local}`);
    return { title: path.basename(local, path.extname(local)) } satisfies YtdlpInfo;
  }

  const { stdout } = await runCommand("yt-dlp", ["--dump-single-json", "--no-playlist", sourceUrl], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return parseJson<YtdlpInfo>(stdout) ?? {};
}

async function downloadSourceAudio(sourceUrl: string, previewDir: string) {
  const local = localSourcePath(sourceUrl);
  if (local) {
    if (!(await fileExists(local))) throw new Error(`Local source file does not exist: ${local}`);
    const targetPath = path.join(previewDir, `source${path.extname(local) || ".audio"}`);
    await fs.copyFile(local, targetPath);
    return targetPath;
  }

  const outputTemplate = path.join(previewDir, "source.%(ext)s");
  await runCommand(
    "yt-dlp",
    [
      "--no-playlist",
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "wav",
      "--audio-quality",
      "0",
      "--output",
      outputTemplate,
      sourceUrl,
    ],
    {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 10,
    },
  );

  const entries = await fs.readdir(previewDir);
  const source = entries.find((entry) => entry.startsWith("source."));
  if (!source) throw new Error("yt-dlp did not produce a source audio file.");
  return path.join(previewDir, source);
}

async function cutPart(input: { sourcePath: string; outputPath: string; startSec: number; durationSec: number }) {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-nostats",
      "-ss",
      String(input.startSec),
      "-t",
      String(input.durationSec),
      "-i",
      input.sourcePath,
      "-vn",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "44100",
      "-ac",
      "2",
      input.outputPath,
    ],
    { timeout: 600000, maxBuffer: 1024 * 1024 * 10 },
  );
}

export async function analyzeAndCutSource(sourceUrl: string, options: { segmentSec?: number } = {}) {
  const previewId = randomUUID();
  const previewDir = path.join(autoCutRoot, previewId);
  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });

  try {
    const info = await getSourceInfo(sourceUrl);
    const sourceTitle = info.title?.trim() || null;
    const sourcePath = await downloadSourceAudio(sourceUrl, previewDir);
    const probe = await probeAudio(sourcePath);
    const durationSec = probe.duration ?? info.duration;
    if (!Number.isFinite(durationSec) || !durationSec || durationSec <= 0) {
      throw new Error("Could not detect a positive audio duration for auto cut.");
    }

    const segmentSec = options.segmentSec ?? DEFAULT_TRIM_SEGMENT_SEC;
    const planned = planFixedTrimSegments({ durationSec, segmentSec });
    const parts: AutoCutManifestPart[] = [];

    for (const part of planned) {
      const outputPath = path.join(previewDir, `part-${String(part.index).padStart(3, "0")}.wav`);
      await cutPart({ sourcePath, outputPath, startSec: part.startSec, durationSec: part.durationSec });
      const title = formatTrimPartTitle(sourceTitle ?? safeTitle(sourceUrl), part);
      parts.push({
        ...part,
        sourceLocalPath: outputPath,
        startLabel: formatDurationClock(part.startSec),
        durationLabel: formatDurationClock(part.durationSec),
        title,
      });
    }

    const manifest: AutoCutManifest = {
      previewId,
      sourceUrl,
      sourceTitle,
      sourcePath,
      durationSec,
      durationLabel: formatDurationClock(durationSec),
      segmentSec,
      createdAt: new Date().toISOString(),
      parts,
    };

    await fs.writeFile(manifestPath(previewId), JSON.stringify(manifest, null, 2), "utf8");
    return publicPreview(manifest);
  } catch (error) {
    await fs.rm(previewDir, { recursive: true, force: true });
    throw error;
  }
}

export async function loadAutoCutManifest(previewId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previewId)) {
    throw new Error("Invalid auto-cut preview id.");
  }

  const raw = await fs.readFile(manifestPath(previewId), "utf8");
  const manifest = parseJson<AutoCutManifest>(raw);
  if (!manifest?.previewId || !Array.isArray(manifest.parts) || !manifest.parts.length) {
    throw new Error("Auto-cut preview manifest is invalid.");
  }

  for (const part of manifest.parts) {
    if (!(await fileExists(part.sourceLocalPath))) {
      throw new Error(`Auto-cut part file is missing: ${part.index}/${part.total}. Please analyze and cut again.`);
    }
  }

  return manifest;
}

export function toPublicAutoCutPreview(manifest: AutoCutManifest) {
  return publicPreview(manifest);
}
