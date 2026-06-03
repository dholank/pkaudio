import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobById, addJobLog, completeJob, failJob, markJobConverted, requeueJobAfterTransientFailure, updateJobProgress, type AudioDiagnosticsPatch } from "@/lib/jobs/repository";
import type { JobView } from "@/lib/jobs/types";
import { clampHeadroomDb, clampTargetLufs, formatTargetLufs, qualityToVorbisQ, type AudioQuality } from "@/lib/audio/options";
import { buildLoudnormAnalyzeFilter, buildLoudnormApplyFilter, buildManualGainFilter, parseLoudnormAnalysis } from "@/lib/audio/processing";
import { runCommand } from "@/lib/system/command";
import { generateWaveformAnalysis } from "@/lib/worker/waveform";

type ProbeResult = {
  sampleRate: number;
  duration: number | null;
  sizeBytes: number | null;
  channels: number | null;
};

type YtdlpInfo = {
  title?: string;
  duration?: number;
  ext?: string;
};

class JobCancelledError extends Error {
  constructor() {
    super("Job was cancelled by user.");
    this.name = "JobCancelledError";
  }
}

const cwd = process.cwd();
const tmpRoot = path.join(cwd, "tmp", "jobs");
const outputRoot = path.join(cwd, "outputs");

function safeTitle(title: string | null | undefined) {
  return (title ?? "audio")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "audio";
}

function outputExtensionForQuality(quality: AudioQuality) {
  return quality;
}

async function ensureDirs(jobId: string) {
  const jobTmpDir = path.join(tmpRoot, jobId);
  await fs.mkdir(jobTmpDir, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });
  return jobTmpDir;
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function localSourcePath(sourceUrl: string) {
  if (sourceUrl.startsWith("file://")) return fileURLToPath(sourceUrl);
  if (path.isAbsolute(sourceUrl)) return sourceUrl;
  return null;
}

async function assertNotCancelled(jobId: string) {
  const latest = await getJobById(jobId);
  if (latest?.status === "cancelled") {
    await addJobLog(jobId, "Worker noticed cancellation and stopped after the current subprocess completed.", "warn");
    throw new JobCancelledError();
  }
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getSourceInfo(job: JobView) {
  const localPath = localSourcePath(job.sourceUrl);
  if (localPath && (await fileExists(localPath))) {
    return { title: path.basename(localPath, path.extname(localPath)) } satisfies YtdlpInfo;
  }

  const { stdout } = await runCommand("yt-dlp", ["--dump-single-json", "--no-playlist", job.sourceUrl], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return parseJson<YtdlpInfo>(stdout);
}

export async function downloadAudio(job: JobView, jobTmpDir: string) {
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
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "wav",
      "--audio-quality",
      "0",
      "--output",
      outputTemplate,
      job.sourceUrl,
    ],
    {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 10,
    },
  );

  const entries = await fs.readdir(jobTmpDir);
  const source = entries.find((entry) => entry.startsWith("source."));
  if (!source) throw new Error("yt-dlp did not produce a source audio file.");
  return path.join(jobTmpDir, source);
}

export async function probeAudio(inputPath: string): Promise<ProbeResult> {
  const { stdout } = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=sample_rate,channels:format=duration,size",
      "-of",
      "json",
      inputPath,
    ],
    { timeout: 60000, maxBuffer: 1024 * 1024 },
  );

  const parsed = parseJson<{ streams?: Array<{ sample_rate?: string; channels?: number }>; format?: { duration?: string; size?: string } }>(stdout);
  const sampleRate = Number(parsed?.streams?.[0]?.sample_rate);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("ffprobe could not detect input sample rate.");
  }

  const duration = Number(parsed?.format?.duration);
  const sizeBytes = Number(parsed?.format?.size);
  const channels = Number(parsed?.streams?.[0]?.channels);
  return {
    sampleRate,
    duration: Number.isFinite(duration) ? duration : null,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    channels: Number.isFinite(channels) ? channels : null,
  };
}

export async function convertToOgg(job: JobView, inputPath: string, sampleRate: number, title: string | null) {
  const outputName = `${safeTitle(title)}-${job.id.slice(0, 8)}-${outputExtensionForQuality(job.quality)}.ogg`;
  const outputPath = path.join(outputRoot, outputName);
  const peakLimitDb = clampHeadroomDb(job.headroomDb);
  const targetLufs = clampTargetLufs(job.targetLufs);
  let filter = buildManualGainFilter({
    sampleRate,
    speed: job.speed,
    amplifyDb: job.amplifyDb,
    peakLimitDb,
    limiterEnabled: job.limiterEnabled,
  });

  if (job.limiterEnabled) {
    const analysisFilter = buildLoudnormAnalyzeFilter({
      sampleRate,
      speed: job.speed,
      amplifyDb: job.amplifyDb,
      targetLufs,
      peakLimitDb,
    });
    await addJobLog(job.id, `FFmpeg loudnorm analysis filter: ${analysisFilter}`);
    const { stderr } = await runCommand(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", inputPath, "-vn", "-filter:a", analysisFilter, "-f", "null", "-"],
      { timeout: 600000, maxBuffer: 1024 * 1024 * 10 },
    );
    const measured = parseLoudnormAnalysis(stderr);
    if (!measured) throw new Error("FFmpeg loudnorm analysis did not return measurement JSON.");
    filter = buildLoudnormApplyFilter({
      sampleRate,
      speed: job.speed,
      amplifyDb: job.amplifyDb,
      targetLufs,
      peakLimitDb,
      measured,
    });
    await addJobLog(job.id, `Loudness analysis: input ${measured.input_i} LUFS, true peak ${measured.input_tp} dBTP, offset ${measured.target_offset} dB.`);
  }

  await addJobLog(job.id, `FFmpeg filter: ${filter}`);
  await addJobLog(job.id, `Audio safety mode: ${job.audioSafetyMode}, Vorbis ${job.quality.toUpperCase()}, loudness target ${formatTargetLufs(targetLufs)}, peak limit ${peakLimitDb} dBFS.`);

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-filter:a",
      filter,
      "-c:a",
      "libvorbis",
      "-q:a",
      qualityToVorbisQ(job.quality),
      "-ar",
      "44100",
      "-ac",
      "2",
      outputPath,
    ],
    { timeout: 600000, maxBuffer: 1024 * 1024 * 10 },
  );

  return outputPath;
}


function parseVolumedetect(stderr: string) {
  const meanMatch = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const maxMatch = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const meanDb = meanMatch ? Number(meanMatch[1]) : null;
  const peakDb = maxMatch ? Number(maxMatch[1]) : null;

  return {
    outputMeanDb: meanDb !== null && Number.isFinite(meanDb) ? meanDb : null,
    outputPeakDb: peakDb !== null && Number.isFinite(peakDb) ? peakDb : null,
  };
}

export async function analyzeOutputAudio(job: JobView, outputPath: string): Promise<AudioDiagnosticsPatch> {
  await addJobLog(job.id, "Analyzing converted OGG diagnostics.");
  const probe = await probeAudio(outputPath);
  const { stderr } = await runCommand(
    "ffmpeg",
    ["-hide_banner", "-i", outputPath, "-af", "volumedetect", "-f", "null", "-"],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );
  const volume = parseVolumedetect(stderr);

  const diagnostics: AudioDiagnosticsPatch = {
    outputDurationSec: probe.duration,
    outputSizeBytes: probe.sizeBytes,
    outputPeakDb: volume.outputPeakDb,
    outputMeanDb: volume.outputMeanDb,
    outputSampleRate: probe.sampleRate,
    outputChannels: probe.channels,
  };

  const parts = [
    probe.duration !== null ? `duration ${probe.duration.toFixed(2)}s` : null,
    probe.sizeBytes !== null ? `size ${(probe.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : null,
    volume.outputPeakDb !== null ? `peak ${volume.outputPeakDb.toFixed(2)} dBFS` : null,
    volume.outputMeanDb !== null ? `mean ${volume.outputMeanDb.toFixed(2)} dB` : null,
    `sample rate ${probe.sampleRate} Hz`,
    probe.channels !== null ? `${probe.channels} channel(s)` : null,
  ].filter(Boolean);
  await addJobLog(job.id, `Output diagnostics: ${parts.join(", ")}.`);

  const warnings: string[] = [];
  if (probe.duration !== null && probe.duration > 420) warnings.push("duration exceeds Roblox 7 minute audio limit");
  if (probe.sizeBytes !== null && probe.sizeBytes > 20 * 1024 * 1024) warnings.push("file size exceeds Roblox 20 MB upload limit");
  const peakLimit = clampHeadroomDb(job.headroomDb);
  if (volume.outputPeakDb !== null && volume.outputPeakDb > -0.5) warnings.push("peak is close to 0 dBFS; clipping risk after playback/encode");
  else if (volume.outputPeakDb !== null && volume.outputPeakDb > peakLimit) warnings.push(`peak exceeds configured ${peakLimit} dBFS peak limit`);
  if (probe.sampleRate !== 44100) warnings.push(`output sample rate is ${probe.sampleRate} Hz instead of 44100 Hz`);
  if (probe.channels !== null && probe.channels !== 2) warnings.push(`output has ${probe.channels} channel(s) instead of stereo`);

  for (const warning of warnings) {
    await addJobLog(job.id, `Quality warning: ${warning}.`, "warn");
  }

  return diagnostics;
}

function isTransientWorkerError(message: string) {
  const lower = message.toLowerCase();
  const permanentMarkers = [
    "invalid or expired",
    "lacks permission",
    "permission",
    "preflight failed",
    "exceeds roblox",
    "selected roblox credential was not found",
    "no roblox credential",
    "not a file",
    "does not exist",
    "unsupported",
    "invalid url",
    "could not detect input sample rate",
    "rejected the asset metadata",
    "content type",
  ];
  if (permanentMarkers.some((marker) => lower.includes(marker))) return false;

  const transientMarkers = [
    "timed out",
    "timeout",
    "econnreset",
    "enotfound",
    "etimedout",
    "network",
    "rate limit",
    "quota",
    "429",
    "roblox service error",
    "http error 5",
    "503",
    "502",
    "500",
    "yt-dlp",
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
