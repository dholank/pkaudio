/**
 * FFmpeg audio conversion to OGG Vorbis with loudnorm/gain/limiter pipeline.
 */
import path from "node:path";
import { addJobLog } from "@/lib/jobs/repository";
import { clampHeadroomDb, clampTargetLufs, formatTargetLufs, qualityToVorbisQ, type AudioQuality } from "@/lib/audio/options";
import { buildLoudnormAnalyzeFilter, buildLoudnormApplyFilter, buildManualGainFilter, parseLoudnormAnalysis } from "@/lib/audio/processing";
import { runCommand } from "@/lib/system/command";
import type { JobView } from "@/lib/jobs/types";

export const cwd = process.cwd();
export const outputRoot = path.join(cwd, "outputs");

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
      "-y", "-i", inputPath,
      "-vn",
      "-filter:a", filter,
      "-c:a", "libvorbis",
      "-q:a", qualityToVorbisQ(job.quality),
      "-ar", "44100",
      "-ac", "2",
      outputPath,
    ],
    { timeout: 600000, maxBuffer: 1024 * 1024 * 10 },
  );

  return outputPath;
}

export { safeTitle, outputExtensionForQuality };
