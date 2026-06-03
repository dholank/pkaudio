export type WaveformPoint = {
  index: number;
  timeSec: number;
  peak: number;
  rms: number;
  peakDb: number | null;
  rmsDb: number | null;
  clips: boolean;
  exceedsHeadroom: boolean;
};

export type WaveformAnalysis = {
  version: 1;
  generatedAt: string;
  source: {
    sampleRate: number;
    totalSamples: number;
    durationSec: number;
    bins: number;
  };
  summary: {
    peak: number;
    rms: number;
    peakDb: number | null;
    rmsDb: number | null;
    clipBins: number;
    headroomExceededBins: number;
    headroomTargetDb: number;
  };
  points: WaveformPoint[];
};

export function waveformHref(outputPath: string) {
  const cleaned = outputPath.replace(/^outputs[\\/]/, "");
  return `/api/waveforms/${cleaned.split(/[\\/]/).map(encodeURIComponent).join("/")}`;
}

export function amplitudeToDb(amplitude: number) {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return null;
  return 20 * Math.log10(Math.max(amplitude, 1e-12));
}
