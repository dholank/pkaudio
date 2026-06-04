"use client";

import { BarChart3, Gauge, Music, Volume2 } from "lucide-react";
import { formatHeadroomDb, formatTargetLufs } from "@/lib/audio/options";
import { formatBytes, formatDb, formatDuration, formatSpeed } from "@/lib/utils";
import type { JobView } from "@/lib/jobs/types";

/**
 * Compact audio metadata row with icons.
 * Used in JobCard, History table, and queue cards.
 *
 * Variant:
 *   compact=true  — icon + short value, single line (default)
 *   compact=false — full text with safety mode + attempt count (for full JobCard)
 */
export function JobAudioMeta({
  job,
  compact = true,
}: {
  job: Pick<JobView, "speed" | "amplifyDb" | "quality" | "limiterEnabled" | "targetLufs" | "headroomDb" | "audioSafetyMode" | "attemptCount" | "maxAttempts">;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <BarChart3 className="size-3 text-zinc-600" />
          {formatSpeed(job.speed)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Volume2 className="size-3 text-zinc-600" />
          {formatDb(job.amplifyDb)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Music className="size-3 text-zinc-600" />
          {job.quality.toUpperCase()}
        </span>
        <span className="inline-flex items-center gap-1">
          {job.limiterEnabled ? <Gauge className="size-3 text-emerald-500" /> : <span className="text-zinc-600"><Volume2 className="size-3" /></span>}
          {job.limiterEnabled ? `${formatTargetLufs(job.targetLufs)} · ${formatHeadroomDb(job.headroomDb)}` : "Limiter off"}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs leading-5 text-zinc-500">
      <span>{formatSpeed(job.speed)}</span>
      <span>•</span>
      <span>gain {formatDb(job.amplifyDb)}</span>
      <span>•</span>
      <span>{job.quality.toUpperCase()}</span>
      <span>•</span>
      <span>{job.audioSafetyMode}</span>
      <span>•</span>
      <span>Attempt {job.attemptCount}/{job.maxAttempts}</span>
      <span>•</span>
      <span>
        {job.limiterEnabled
          ? `${formatTargetLufs(job.targetLufs)} → peak ≤ ${formatHeadroomDb(job.headroomDb)}`
          : "Limiter OFF"}
      </span>
    </div>
  );
}

/**
 * Simple diagnostics line: duration · size · peak dBFS.
 * Shown below the audio meta in history table rows.
 */
export function JobOutputDiagnostics({
  durationSec,
  sizeBytes,
  peakDb,
}: {
  durationSec: number | null;
  sizeBytes: number | null;
  peakDb: number | null;
}) {
  if (durationSec === null && sizeBytes === null && peakDb === null) return null;

  return (
    <div className="mt-1 text-[11px] text-zinc-600">
      {durationSec !== null ? formatDuration(durationSec) : ""}
      {durationSec !== null && sizeBytes !== null ? " · " : ""}
      {sizeBytes !== null ? formatBytes(sizeBytes) : ""}
      {peakDb !== null ? ` · ${peakDb.toFixed(1)} dBFS` : ""}
    </div>
  );
}
