import {
  LOUDNESS_RANGE_LUFS,
  clampHeadroomDb,
  clampTargetLufs,
  limiterLimitForHeadroomDb,
  type LoudnormAnalysis,
} from "@/lib/audio/options";

export type AudioFilterInput = {
  sampleRate: number;
  speed: number;
  amplifyDb: number;
};

export type LoudnormFilterInput = AudioFilterInput & {
  targetLufs: number;
  peakLimitDb: number;
};

export type LoudnormApplyFilterInput = LoudnormFilterInput & {
  measured: LoudnormAnalysis;
};

function ffNumber(value: number, digits = 6) {
  return Number(value.toFixed(digits)).toString();
}

export function buildPlaybackRateFilterParts({ sampleRate, speed, amplifyDb }: AudioFilterInput) {
  const filterParts = [`asetrate=${ffNumber(sampleRate, 0)}*${ffNumber(speed, 6)}`, "aresample=44100"];
  if (Math.abs(amplifyDb) >= 0.01) filterParts.push(`volume=${ffNumber(amplifyDb, 2)}dB`);
  return filterParts;
}

export function buildLoudnormAnalyzeFilter({ sampleRate, speed, amplifyDb, targetLufs, peakLimitDb }: LoudnormFilterInput) {
  const target = clampTargetLufs(targetLufs);
  const peak = clampHeadroomDb(peakLimitDb);
  void amplifyDb;
  return [
    ...buildPlaybackRateFilterParts({ sampleRate, speed, amplifyDb: 0 }),
    `loudnorm=I=${ffNumber(target, 1)}:TP=${ffNumber(peak, 1)}:LRA=${LOUDNESS_RANGE_LUFS}:print_format=json`,
  ].join(",");
}

export function buildLoudnormApplyFilter({ sampleRate, speed, amplifyDb, targetLufs, peakLimitDb, measured }: LoudnormApplyFilterInput) {
  const target = clampTargetLufs(targetLufs);
  const peak = clampHeadroomDb(peakLimitDb);
  return [
    ...buildPlaybackRateFilterParts({ sampleRate, speed, amplifyDb: 0 }),
    [
      `loudnorm=I=${ffNumber(target, 1)}`,
      `TP=${ffNumber(peak, 1)}`,
      `LRA=${LOUDNESS_RANGE_LUFS}`,
      `measured_I=${measured.input_i}`,
      `measured_TP=${measured.input_tp}`,
      `measured_LRA=${measured.input_lra}`,
      `measured_thresh=${measured.input_thresh}`,
      `offset=${measured.target_offset}`,
      "linear=true",
      "print_format=summary",
    ].join(":"),
    ...(Math.abs(amplifyDb) >= 0.01 ? [`volume=${ffNumber(amplifyDb, 2)}dB`] : []),
    `alimiter=limit=${limiterLimitForHeadroomDb(peak).toFixed(3)}:level=false`,
  ].join(",");
}

export function buildManualGainFilter({ sampleRate, speed, amplifyDb, peakLimitDb, limiterEnabled }: AudioFilterInput & { peakLimitDb: number; limiterEnabled: boolean }) {
  const filterParts = buildPlaybackRateFilterParts({ sampleRate, speed, amplifyDb });
  if (limiterEnabled) filterParts.push(`alimiter=limit=${limiterLimitForHeadroomDb(peakLimitDb).toFixed(3)}:level=false`);
  return filterParts.join(",");
}

export function parseLoudnormAnalysis(stderr: string): LoudnormAnalysis | null {
  const start = stderr.indexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(stderr.slice(start, end + 1)) as Partial<LoudnormAnalysis>;
    const values = {
      input_i: parsed.input_i,
      input_tp: parsed.input_tp,
      input_lra: parsed.input_lra,
      input_thresh: parsed.input_thresh,
      target_offset: parsed.target_offset,
    };
    if (Object.values(values).every((value) => typeof value === "string" && value.trim() !== "")) {
      return values as LoudnormAnalysis;
    }
  } catch {
    return null;
  }

  return null;
}
