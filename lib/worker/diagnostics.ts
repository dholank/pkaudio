/**
 * Post-conversion diagnostics and quality warnings.
 */
import { addJobLog, type AudioDiagnosticsPatch } from "@/lib/jobs/repository";
import { clampHeadroomDb } from "@/lib/audio/options";
import { runCommand } from "@/lib/system/command";
import { probeAudio } from "@/lib/worker/probe";
import type { JobView } from "@/lib/jobs/types";

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
