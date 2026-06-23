/**
 * Source resolution: yt-dlp metadata and audio download.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addJobLog } from "@/lib/jobs/repository";
import { runCommand } from "@/lib/system/command";
import type { JobView } from "@/lib/jobs/types";

export type YtdlpInfo = {
  title?: string;
  duration?: number;
  ext?: string;
};

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function localSourcePath(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return null;
  if (sourceUrl.startsWith("file://")) return fileURLToPath(sourceUrl);
  if (path.isAbsolute(sourceUrl)) return sourceUrl;
  return null;
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function getSourceInfo(job: JobView) {
  const trimLocalPath = localSourcePath(job.sourceLocalPath);
  if (trimLocalPath && (await fileExists(trimLocalPath))) {
    return { title: job.title ?? path.basename(trimLocalPath, path.extname(trimLocalPath)) } satisfies YtdlpInfo;
  }

  const localPath = localSourcePath(job.sourceUrl);
  if (localPath && (await fileExists(localPath))) {
    return { title: path.basename(localPath, path.extname(localPath)) } satisfies YtdlpInfo;
  }

  const { stdout } = await runCommand("yt-dlp", ["--dump-single-json", "--no-playlist", "--no-update", "--js-runtimes", "node", job.sourceUrl], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return parseJson<YtdlpInfo>(stdout);
}

export async function downloadAudio(job: JobView, jobTmpDir: string) {
  const trimLocalPath = localSourcePath(job.sourceLocalPath);
  if (trimLocalPath) {
    if (!(await fileExists(trimLocalPath))) throw new Error(`Trimmed source file does not exist: ${trimLocalPath}`);
    const extension = path.extname(trimLocalPath) || ".audio";
    const targetPath = path.join(jobTmpDir, `source${extension}`);
    await fs.copyFile(trimLocalPath, targetPath);
    await addJobLog(job.id, `Using local auto-cut part: ${trimLocalPath}`);
    return targetPath;
  }

  const localPath = localSourcePath(job.sourceUrl);
  if (localPath) {
    if (!(await fileExists(localPath))) throw new Error(`Local source file does not exist: ${localPath}`);
    const extension = path.extname(localPath) || ".audio";
    const targetPath = path.join(jobTmpDir, `source${extension}`);
    await fs.copyFile(localPath, targetPath);
    await addJobLog(job.id, `Using local source file: ${localPath}`);
    return targetPath;
  }

  const outputTemplate = path.join(jobTmpDir, "source.%(ext)s");
  await runCommand(
    "yt-dlp",
    [
      "--no-playlist",
      "-f", "bestaudio/best",
      "--extract-audio",
      "--audio-format", "wav",
      "--audio-quality", "0",
      "--no-update",
      "--js-runtimes", "node",
      "--output", outputTemplate,
      job.sourceUrl,
    ],
    { timeout: 600000, maxBuffer: 1024 * 1024 * 10 },
  );

  const entries = await fs.readdir(jobTmpDir);
  const source = entries.find((entry) => entry.startsWith("source."));
  if (!source) throw new Error("yt-dlp did not produce a source audio file.");
  return path.join(jobTmpDir, source);
}
