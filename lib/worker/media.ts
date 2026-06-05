/**
 * Worker media orchestration — wires source, probe, convert, diagnostics, waveform into processMediaJob.
 * Importing from sub-modules is preferred; this file keeps the job lifecycle flow readable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getJobById, addJobLog, completeJob, failJob, markJobConverted,
  requeueJobAfterTransientFailure, updateJobProgress, type AudioDiagnosticsPatch,
} from "@/lib/jobs/repository";
import type { JobView } from "@/lib/jobs/types";
import { getSourceInfo, downloadAudio } from "@/lib/worker/source";
import { probeAudio } from "@/lib/worker/probe";
import { convertToOgg } from "@/lib/worker/convert";
import { analyzeOutputAudio } from "@/lib/worker/diagnostics";
import { generateWaveformAnalysis } from "@/lib/worker/waveform";

// Re-export for backward compat
export { getSourceInfo, downloadAudio } from "@/lib/worker/source";
export { probeAudio } from "@/lib/worker/probe";
export { convertToOgg } from "@/lib/worker/convert";
export { analyzeOutputAudio } from "@/lib/worker/diagnostics";

// ─── Shared constants ───
const cwd = process.cwd();
const tmpRoot = path.join(cwd, "tmp", "jobs");
const outputRoot = path.join(cwd, "outputs");

// ─── Internal helpers ───
class JobCancelledError extends Error {
  constructor() {
    super("Job was cancelled by user.");
    this.name = "JobCancelledError";
  }
}

async function ensureDirs(jobId: string) {
  const jobTmpDir = path.join(tmpRoot, jobId);
  await fs.mkdir(jobTmpDir, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });
  return jobTmpDir;
}

async function assertNotCancelled(jobId: string) {
  const latest = await getJobById(jobId);
  if (latest?.status === "cancelled") {
    await addJobLog(jobId, "Worker noticed cancellation and stopped after the current subprocess completed.", "warn");
    throw new JobCancelledError();
  }
}

function isTransientWorkerError(message: string) {
  const lower = message.toLowerCase();
  const permanentMarkers = [
    "invalid or expired", "lacks permission", "permission",
    "preflight failed", "exceeds roblox", "selected roblox credential was not found",
    "no roblox credential", "not a file", "does not exist", "unsupported",
    "invalid url", "could not detect input sample rate",
    "rejected the asset metadata", "content type",
  ];
  if (permanentMarkers.some((marker) => lower.includes(marker))) return false;

  const transientMarkers = [
    "timed out", "timeout", "econnreset", "enotfound", "etimedout",
    "network", "rate limit", "quota", "429",
    "roblox service error", "http error 5", "503", "502", "500", "yt-dlp",
  ];
  return transientMarkers.some((marker) => lower.includes(marker));
}

async function finalizeConvertedOutput(job: JobView, outputPath: string, title: string | null, diagnostics: AudioDiagnosticsPatch) {
  const relativeOutputPath = path.relative(cwd, outputPath);

  if (!job.uploadEnabled) {
    await completeJob(job.id, relativeOutputPath, title, diagnostics);
    return;
  }

  await markJobConverted(job.id, relativeOutputPath, title, diagnostics);
  await addJobLog(job.id, "Conversion worker finished. Serial upload worker will upload this OGG after the batch conversion gate clears.");
}

// ─── Main pipeline ───
export async function processMediaJob(job: JobView) {
  const jobTmpDir = await ensureDirs(job.id);
  let title: string | null = job.title;

  try {
    await addJobLog(job.id, "Worker started conversion pipeline.");

    await assertNotCancelled(job.id);
    await updateJobProgress(job.id, { status: "downloading", progress: 8 });
    await addJobLog(job.id, "Reading metadata.");
    const info = await getSourceInfo(job);
    title = info?.title ?? job.title ?? null;
    if (title) {
      await updateJobProgress(job.id, { title });
      await addJobLog(job.id, `Source title: ${title}`);
    }

    await assertNotCancelled(job.id);
    await addJobLog(job.id, "Downloading/extracting source audio.");
    const sourcePath = await downloadAudio(job, jobTmpDir);
    await updateJobProgress(job.id, { status: "probing", progress: 42, title });

    await assertNotCancelled(job.id);
    await addJobLog(job.id, "Probing input audio with ffprobe.");
    const probe = await probeAudio(sourcePath);
    await addJobLog(job.id, `Input sample rate: ${probe.sampleRate} Hz${probe.duration ? `, duration: ${probe.duration.toFixed(2)}s` : ""}.`);

    await assertNotCancelled(job.id);
    await updateJobProgress(job.id, { status: "converting", progress: 68, title });
    await addJobLog(job.id, "Converting to OGG Vorbis.");
    const outputPath = await convertToOgg(job, sourcePath, probe.sampleRate, title);

    await assertNotCancelled(job.id);
    const diagnostics = await analyzeOutputAudio(job, outputPath);

    try {
      await addJobLog(job.id, "Generating waveform and loudness graph artifact.");
      const waveform = await generateWaveformAnalysis(outputPath, { headroomDb: job.headroomDb });
      await addJobLog(
        job.id,
        `Waveform artifact generated: ${path.relative(cwd, waveform.waveformPath)} (${waveform.analysis.source.bins} bins, peak ${waveform.analysis.summary.peakDb?.toFixed(2) ?? "—"} dBFS).`,
      );
    } catch (error) {
      await addJobLog(job.id, `Waveform generation failed: ${error instanceof Error ? error.message : "Unknown error."}`, "warn");
    }

    await assertNotCancelled(job.id);
    await finalizeConvertedOutput(job, outputPath, title, diagnostics);
    return true;
  } catch (error) {
    if (error instanceof JobCancelledError) return false;

    const message = error instanceof Error ? error.message : "Unknown worker error.";
    const latest = await getJobById(job.id);
    if (latest && latest.attemptCount < latest.maxAttempts && isTransientWorkerError(message)) {
      await requeueJobAfterTransientFailure(job.id, message);
      return false;
    }

    await failJob(job.id, message);
    return false;
  }
}

export function isRunningAsMain(importMetaUrl: string) {
  return process.argv[1] === fileURLToPath(importMetaUrl);
}
