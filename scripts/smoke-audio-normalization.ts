#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import {
  AUDIO_SAFETY_MODE_PRESETS,
  clampTargetLufs,
  formatTargetLufs,
  type LoudnormAnalysis,
} from "@/lib/audio/options";
import { buildLoudnormAnalyzeFilter, buildLoudnormApplyFilter, parseLoudnormAnalysis } from "@/lib/audio/processing";
import { runCommand } from "@/lib/system/command";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

assertEqual(AUDIO_SAFETY_MODE_PRESETS.roblox_safe.targetLufs, -14, "Roblox Safe should target clean/stable -14 LUFS");
assertEqual(AUDIO_SAFETY_MODE_PRESETS.high_quality.targetLufs, -13, "High Quality should target balanced -13 LUFS");
assertEqual(AUDIO_SAFETY_MODE_PRESETS.loud.targetLufs, -12, "Loud should target louder -12 LUFS");
assertEqual(clampTargetLufs(-99), -18, "Target LUFS should clamp low values");
assertEqual(clampTargetLufs(0), -10, "Target LUFS should clamp hot values");
assertEqual(formatTargetLufs(-13), "-13 LUFS", "Target LUFS formatting should be human-readable");

const rawLoudnormStderr = `
[Parsed_loudnorm_3 @ 0x7f00] 
{
    "input_i" : "-22.54",
    "input_tp" : "-7.23",
    "input_lra" : "5.40",
    "input_thresh" : "-32.88",
    "output_i" : "-13.96",
    "output_tp" : "-3.02",
    "output_lra" : "4.90",
    "output_thresh" : "-24.20",
    "normalization_type" : "dynamic",
    "target_offset" : "-0.04"
}
`;
const measured = parseLoudnormAnalysis(rawLoudnormStderr);
assert(measured, "Should parse loudnorm JSON emitted on stderr");
assertEqual(measured.input_i, "-22.54", "Parsed measured integrated loudness");
assertEqual(measured.target_offset, "-0.04", "Parsed target offset");

const analyzeFilter = buildLoudnormAnalyzeFilter({
  sampleRate: 48000,
  speed: 2.3,
  amplifyDb: 1.5,
  targetLufs: -14,
  peakLimitDb: -3,
});
assertEqual(
  analyzeFilter,
  "asetrate=48000*2.3,aresample=44100,loudnorm=I=-14:TP=-3:LRA=11:print_format=json",
  "Analyze filter should run playback-rate processing before loudnorm analysis and ignore gain trim",
);

const applyFilter = buildLoudnormApplyFilter({
  sampleRate: 48000,
  speed: 2.3,
  amplifyDb: 1.5,
  targetLufs: -14,
  peakLimitDb: -3,
  measured: measured as LoudnormAnalysis,
});
assert(applyFilter.includes("asetrate=48000*2.3,aresample=44100,loudnorm="), "Apply filter should normalize after speed processing");
assert(applyFilter.includes("loudnorm=I=-14:TP=-3:LRA=11"), "Apply filter should target LUFS and peak limit");
assert(applyFilter.includes("measured_I=-22.54:measured_TP=-7.23:measured_LRA=5.40:measured_thresh=-32.88:offset=-0.04"), "Apply filter should use first-pass loudnorm measurements");
assert(applyFilter.includes("print_format=summary,volume=1.5dB,alimiter"), "Apply filter should apply amplify as post-normalization trim before limiter");
assert(applyFilter.endsWith("alimiter=limit=0.708:level=false"), "Apply filter should keep alimiter as final safety ceiling at -3 dBFS without auto makeup gain");

function parseVolumedetectPeak(stderr: string) {
  const match = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  return match ? Number(match[1]) : null;
}

async function assertFfmpegLimiterSmoke() {
  const smokeDir = path.join(process.cwd(), "tmp", "smoke-audio-normalization");
  const sourcePath = path.join(smokeDir, "source.wav");
  const outputPath = path.join(smokeDir, "normalized.ogg");
  await fs.rm(smokeDir, { recursive: true, force: true });
  await fs.mkdir(smokeDir, { recursive: true });

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3:sample_rate=48000",
      "-filter:a",
      "volume=-18dB",
      sourcePath,
    ],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );

  const firstPassFilter = buildLoudnormAnalyzeFilter({
    sampleRate: 48000,
    speed: 1,
    amplifyDb: 6,
    targetLufs: -14,
    peakLimitDb: -3,
  });
  const firstPass = await runCommand(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", sourcePath, "-vn", "-filter:a", firstPassFilter, "-f", "null", "-"],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );
  const realMeasured = parseLoudnormAnalysis(firstPass.stderr);
  assert(realMeasured, "Real FFmpeg loudnorm pass should emit parseable JSON");

  const limiterFilter = buildLoudnormApplyFilter({
    sampleRate: 48000,
    speed: 1,
    amplifyDb: 6,
    targetLufs: -14,
    peakLimitDb: -3,
    measured: realMeasured,
  });
  await runCommand(
    "ffmpeg",
    ["-y", "-i", sourcePath, "-vn", "-filter:a", limiterFilter, "-c:a", "libvorbis", "-q:a", "7", "-ar", "44100", "-ac", "2", outputPath],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );

  const volume = await runCommand(
    "ffmpeg",
    ["-hide_banner", "-i", outputPath, "-af", "volumedetect", "-f", "null", "-"],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );
  const peakDb = parseVolumedetectPeak(volume.stderr);
  assert(peakDb !== null, "Converted OGG should have a measurable peak");
  assert(peakDb <= -2.0, `Limiter smoke should keep encoded peak close to -3 dBFS, got ${peakDb} dBFS`);

  await fs.rm(smokeDir, { recursive: true, force: true });
}

async function main() {
  await assertFfmpegLimiterSmoke();
  console.log("[smoke] audio loudness normalization filters and FFmpeg limiter smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
