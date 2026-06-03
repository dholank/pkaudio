export const AUDIO_QUALITIES = ["q5", "q6", "q7", "q8"] as const;
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];

export const AUDIO_SAFETY_MODES = ["roblox_safe", "high_quality", "loud", "custom"] as const;
export type AudioSafetyMode = (typeof AUDIO_SAFETY_MODES)[number];

export const DEFAULT_HEADROOM_DB = -3;
export const MIN_HEADROOM_DB = -6;
export const MAX_HEADROOM_DB = -1;

export const DEFAULT_TARGET_LUFS = -14;
export const MIN_TARGET_LUFS = -18;
export const MAX_TARGET_LUFS = -10;
export const LOUDNESS_RANGE_LUFS = 11;

export type LoudnormAnalysis = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

export const QUALITY_LABELS: Record<AudioQuality, string> = {
  q5: "q5 Smaller",
  q6: "q6 Balanced",
  q7: "q7 High",
  q8: "q8 Maximum",
};

export const QUALITY_DESCRIPTIONS: Record<AudioQuality, string> = {
  q5: "Smaller files, still acceptable for short SFX.",
  q6: "Balanced size/quality for Roblox audio.",
  q7: "High quality default for most PKAudio conversions.",
  q8: "Maximum local quality; file size can grow quickly.",
};

export const AUDIO_SAFETY_MODE_LABELS: Record<AudioSafetyMode, string> = {
  roblox_safe: "Roblox Safe",
  high_quality: "High Quality",
  loud: "Loud / Boosted",
  custom: "Custom",
};

export const AUDIO_SAFETY_MODE_DESCRIPTIONS: Record<AudioSafetyMode, string> = {
  roblox_safe: "Conservative -14 LUFS loudness normalization with a -3 dBFS peak limit for Roblox safety.",
  high_quality: "Balanced -13 LUFS normalization, q8 Vorbis, and a -2.5 dBFS peak limit for clean output.",
  loud: "Hotter -12 LUFS normalization with a -2 dBFS peak limit for punchy SFX/BGM.",
  custom: "Manual quality, loudness target, gain trim, limiter, and peak limit controls.",
};

export const AUDIO_SAFETY_MODE_PRESETS: Record<Exclude<AudioSafetyMode, "custom">, { quality: AudioQuality; limiterEnabled: boolean; headroomDb: number; targetLufs: number; amplifyDb?: number }> = {
  roblox_safe: { quality: "q7", limiterEnabled: true, headroomDb: -3, targetLufs: -14, amplifyDb: 0 },
  high_quality: { quality: "q8", limiterEnabled: true, headroomDb: -2.5, targetLufs: -13, amplifyDb: 0 },
  loud: { quality: "q7", limiterEnabled: true, headroomDb: -2, targetLufs: -12, amplifyDb: 0 },
};

export function isAudioQuality(value: string): value is AudioQuality {
  return (AUDIO_QUALITIES as readonly string[]).includes(value);
}

export function isAudioSafetyMode(value: string): value is AudioSafetyMode {
  return (AUDIO_SAFETY_MODES as readonly string[]).includes(value);
}

export function clampHeadroomDb(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_HEADROOM_DB;
  return Math.max(MIN_HEADROOM_DB, Math.min(MAX_HEADROOM_DB, value));
}

export function clampTargetLufs(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TARGET_LUFS;
  return Math.max(MIN_TARGET_LUFS, Math.min(MAX_TARGET_LUFS, value));
}

export function qualityToVorbisQ(quality: AudioQuality) {
  return quality.replace("q", "");
}

export function limiterLimitForHeadroomDb(headroomDb: number) {
  return Math.pow(10, clampHeadroomDb(headroomDb) / 20);
}

export function formatHeadroomDb(headroomDb: number) {
  const value = clampHeadroomDb(headroomDb);
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} dBFS`;
}

export function formatTargetLufs(targetLufs: number) {
  const value = clampTargetLufs(targetLufs);
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} LUFS`;
}
