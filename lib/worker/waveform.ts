import fs from "node:fs/promises";
import { clampHeadroomDb, limiterLimitForHeadroomDb } from "@/lib/audio/options";
import { amplitudeToDb, type WaveformAnalysis, type WaveformPoint } from "@/lib/audio/waveform";
import { runCommand } from "@/lib/system/command";

const ANALYSIS_SAMPLE_RATE = 8000;
const DEFAULT_BINS = 240;
const CLIP_THRESHOLD_LINEAR = Math.pow(10, -0.1 / 20);

function safeInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function outputWaveformPath(outputPath: string) {
  return `${outputPath}.waveform.json`;
}

function readSample(buffer: Buffer, index: number) {
  return Math.abs(buffer.readInt16LE(index * 2) / 32768);
}

function summarizePoint(index: number, start: number, end: number, totalSamples: number, durationSec: number, buffer: Buffer, headroomLinear: number): WaveformPoint {
  let peak = 0;
  let squareSum = 0;
  const count = Math.max(1, end - start);

  for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
    const amplitude = readSample(buffer, sampleIndex);
    if (amplitude > peak) peak = amplitude;
    squareSum += amplitude * amplitude;
  }

  const rms = Math.sqrt(squareSum / count);
  const timeSec = totalSamples > 0 ? (start / totalSamples) * durationSec : 0;
  return {
    index,
    timeSec,
    peak: Number(peak.toFixed(6)),
    rms: Number(rms.toFixed(6)),
    peakDb: amplitudeToDb(peak),
    rmsDb: amplitudeToDb(rms),
    clips: peak >= CLIP_THRESHOLD_LINEAR,
    exceedsHeadroom: peak > headroomLinear,
  };
}

export async function generateWaveformAnalysis(outputPath: string, options: { bins?: number; headroomDb?: number } = {}) {
  const bins = safeInteger(options.bins ?? Number(process.env.PKAUDIO_WAVEFORM_BINS ?? DEFAULT_BINS), DEFAULT_BINS);
  const headroomDb = clampHeadroomDb(options.headroomDb ?? -3);
  const headroomLinear = limiterLimitForHeadroomDb(headroomDb);
  const rawPath = `${outputPath}.waveform.raw`;
  const waveformPath = outputWaveformPath(outputPath);

  try {
    await runCommand(
      "ffmpeg",
      ["-y", "-hide_banner", "-loglevel", "error", "-i", outputPath, "-vn", "-ac", "1", "-ar", String(ANALYSIS_SAMPLE_RATE), "-f", "s16le", rawPath],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );

    const buffer = await fs.readFile(rawPath);
    const totalSamples = Math.floor(buffer.length / 2);
    const durationSec = totalSamples / ANALYSIS_SAMPLE_RATE;
    const actualBins = Math.max(1, Math.min(bins, totalSamples || 1));
    const points: WaveformPoint[] = [];

    for (let index = 0; index < actualBins; index += 1) {
      const start = Math.floor((index / actualBins) * totalSamples);
      const end = index === actualBins - 1 ? totalSamples : Math.max(start + 1, Math.floor(((index + 1) / actualBins) * totalSamples));
      points.push(summarizePoint(index, start, end, totalSamples, durationSec, buffer, headroomLinear));
    }

    const peak = points.reduce((max, point) => Math.max(max, point.peak), 0);
    const rms = points.length ? Math.sqrt(points.reduce((sum, point) => sum + point.rms * point.rms, 0) / points.length) : 0;
    const analysis: WaveformAnalysis = {
      version: 1,
      generatedAt: new Date().toISOString(),
      source: {
        sampleRate: ANALYSIS_SAMPLE_RATE,
        totalSamples,
        durationSec,
        bins: actualBins,
      },
      summary: {
        peak: Number(peak.toFixed(6)),
        rms: Number(rms.toFixed(6)),
        peakDb: amplitudeToDb(peak),
        rmsDb: amplitudeToDb(rms),
        clipBins: points.filter((point) => point.clips).length,
        headroomExceededBins: points.filter((point) => point.exceedsHeadroom).length,
        headroomTargetDb: headroomDb,
      },
      points,
    };

    await fs.writeFile(waveformPath, JSON.stringify(analysis));
    return { waveformPath, analysis };
  } finally {
    await fs.rm(rawPath, { force: true });
  }
}
