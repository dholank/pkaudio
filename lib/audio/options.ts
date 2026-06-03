export const AUDIO_QUALITIES = ["q5", "q6", "q7", "q8"] as const;
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];

export const AUDIO_SAFETY_MODES = ["roblox_safe", "high_quality", "loud", "custom"] as const;
export type AudioSafetyMode = (typeof AUDIO_SAFETY_MODES)[number];

export const DEFAULT_HEADROOM_DB = -3;
export const MIN_HEADROOM_DB = -6;
export const MAX_HEADROOM_DB = -1;

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
  roblox_safe: "Conservative -3 dBFS headroom for Roblox moderation/playback safety.",
  high_quality: "Keeps limiter on and uses q8 with a little more headroom for clean output.",
  loud: "Hotter output for punchy SFX; waveform warnings become more important.",
  custom: "Manual quality, limiter, gain, and headroom controls.",
};

export const AUDIO_SAFETY_MODE_PRESETS: Record<Exclude<AudioSafetyMode, "custom">, { quality: AudioQuality; limiterEnabled: boolean; headroomDb: number; amplifyDb?: number }> = {
  roblox_safe: { quality: "q7", limiterEnabled: true, headroomDb: -3 },
  high_quality: { quality: "q8", limiterEnabled: true, headroomDb: -2.5 },
  loud: { quality: "q7", limiterEnabled: true, headroomDb: -1.5, amplifyDb: 4 },
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
