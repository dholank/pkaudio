import { cleanRobloxAudioTitle } from "@/lib/roblox/metadata";

export const DEFAULT_TRIM_SEGMENT_SEC = 5 * 60;

export type FixedTrimSegment = {
  index: number;
  total: number;
  startSec: number;
  durationSec: number;
};

export type PlanFixedTrimSegmentsInput = {
  durationSec: number;
  segmentSec?: number;
};

function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive duration in seconds.`);
  }
}

function roundMillis(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function planFixedTrimSegments({ durationSec, segmentSec = DEFAULT_TRIM_SEGMENT_SEC }: PlanFixedTrimSegmentsInput): FixedTrimSegment[] {
  assertPositiveFinite(durationSec, "Audio duration");
  assertPositiveFinite(segmentSec, "Segment duration");

  const total = Math.max(1, Math.ceil(durationSec / segmentSec));
  return Array.from({ length: total }, (_, partIndex) => {
    const startSec = roundMillis(partIndex * segmentSec);
    const remaining = Math.max(0, durationSec - startSec);
    const duration = Math.min(segmentSec, remaining);
    return {
      index: partIndex + 1,
      total,
      startSec,
      durationSec: roundMillis(duration),
    };
  }).filter((part) => part.durationSec > 0);
}

export function formatTrimPartNumber(part: Pick<FixedTrimSegment, "index" | "total">) {
  const width = Math.max(2, String(part.total).length);
  return `${String(part.index).padStart(width, "0")}/${String(part.total).padStart(width, "0")}`;
}

export function formatTrimPartTitle(rawTitle: string | null | undefined, part: Pick<FixedTrimSegment, "index" | "total">) {
  const baseTitle = (rawTitle ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return `${baseTitle || cleanRobloxAudioTitle(null)} Part ${formatTrimPartNumber(part)}`;
}

export function formatDurationClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
