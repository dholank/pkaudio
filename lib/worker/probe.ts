/**
 * Audio probing via ffprobe.
 */
import { runCommand } from "@/lib/system/command";

export type ProbeResult = {
  sampleRate: number;
  duration: number | null;
  sizeBytes: number | null;
  channels: number | null;
};

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function probeAudio(inputPath: string): Promise<ProbeResult> {
  const { stdout } = await runCommand(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=sample_rate,channels:format=duration,size",
      "-of", "json",
      inputPath,
    ],
    { timeout: 60000, maxBuffer: 1024 * 1024 },
  );

  const parsed = parseJson<{
    streams?: Array<{ sample_rate?: string; channels?: number }>;
    format?: { duration?: string; size?: string };
  }>(stdout);

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
