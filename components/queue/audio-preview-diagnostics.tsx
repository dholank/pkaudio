"use client";

import { AlertTriangle, Activity, Headphones, Info, Volume2 } from "lucide-react";
import { WaveformLoudnessGraph } from "@/components/queue/waveform-loudness-graph";
import { Badge } from "@/components/ui/badge";
import { formatHeadroomDb } from "@/lib/audio/options";
import { formatBytes } from "@/lib/utils";
import type { JobView } from "@/lib/jobs/types";

function outputHref(outputPath: string, preview = false) {
  const cleaned = outputPath.replace(/^outputs\//, "");
  const base = `/api/outputs/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
  return preview ? `${base}?preview=1` : base;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatDbValue(value: number | null, suffix = " dB") {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function buildWarnings(job: JobView) {
  const warnings: Array<{ level: "warn" | "error"; message: string }> = [];

  if (job.outputDurationSec !== null) {
    if (job.outputDurationSec > 420) warnings.push({ level: "error", message: "Duration exceeds Roblox 7 minute limit." });
    else if (job.outputDurationSec > 390) warnings.push({ level: "warn", message: "Duration is close to Roblox 7 minute limit." });
  }

  if (job.outputSizeBytes !== null) {
    if (job.outputSizeBytes > 20 * 1024 * 1024) warnings.push({ level: "error", message: "File size exceeds Roblox 20 MB upload limit." });
    else if (job.outputSizeBytes > 18 * 1024 * 1024) warnings.push({ level: "warn", message: "File size is close to Roblox 20 MB upload limit." });
  }

  if (job.outputPeakDb !== null) {
    if (job.outputPeakDb > -0.5) warnings.push({ level: "error", message: "Peak is close to 0 dBFS; clipping risk." });
    else if (job.outputPeakDb > job.headroomDb) warnings.push({ level: "warn", message: `Peak is above the ${formatHeadroomDb(job.headroomDb)} headroom target.` });
  }

  if (job.outputSampleRate !== null && job.outputSampleRate !== 44100) {
    warnings.push({ level: "warn", message: `Output sample rate is ${job.outputSampleRate} Hz, expected 44100 Hz.` });
  }

  if (job.outputChannels !== null && job.outputChannels !== 2) {
    warnings.push({ level: "warn", message: `Output has ${job.outputChannels} channel(s), expected stereo.` });
  }

  return warnings;
}

function DiagnosticTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-sm text-zinc-100">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] text-zinc-600">{detail}</p> : null}
    </div>
  );
}

export function AudioPreviewDiagnostics({ job }: { job: JobView }) {
  if (!job.outputPath) return null;

  const hasDiagnostics = [
    job.outputDurationSec,
    job.outputSizeBytes,
    job.outputPeakDb,
    job.outputMeanDb,
    job.outputSampleRate,
    job.outputChannels,
  ].some((value) => value !== null);
  const warnings = buildWarnings(job);

  return (
    <div className="mt-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.045] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-50">
          <Headphones className="size-4 text-cyan-300" /> Audio preview
        </div>
        <Badge variant={warnings.some((warning) => warning.level === "error") ? "destructive" : warnings.length ? "warning" : "success"}>
          {warnings.length ? `${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "Roblox-ready checks passed"}
        </Badge>
      </div>

      <audio className="h-10 w-full" controls preload="metadata" src={outputHref(job.outputPath, true)} />

      <WaveformLoudnessGraph outputPath={job.outputPath} />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DiagnosticTile label="Duration" value={formatDuration(job.outputDurationSec)} detail="Roblox max 7:00" />
        <DiagnosticTile label="Size" value={job.outputSizeBytes !== null ? formatBytes(job.outputSizeBytes) : "—"} detail="Roblox max 20 MB" />
        <DiagnosticTile label="Peak" value={formatDbValue(job.outputPeakDb, " dBFS")} detail={`Target ≤ ${formatHeadroomDb(job.headroomDb)}`} />
        <DiagnosticTile label="Mean" value={formatDbValue(job.outputMeanDb)} />
        <DiagnosticTile label="Rate" value={job.outputSampleRate ? `${job.outputSampleRate} Hz` : "—"} detail="Target 44100 Hz" />
        <DiagnosticTile label="Channels" value={job.outputChannels ? `${job.outputChannels}` : "—"} detail="Target stereo" />
      </div>

      {warnings.length ? (
        <div className="mt-3 space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning.message}
              className={
                warning.level === "error"
                  ? "flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                  : "flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              }
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : hasDiagnostics ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Activity className="mt-0.5 size-4 shrink-0" /> Diagnostics are within current Roblox audio upload targets.
        </div>
      ) : (
        <div className="mt-3 flex gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-zinc-400">
          <Info className="mt-0.5 size-4 shrink-0" /> Diagnostics will appear after the worker reprocesses or analyzes this output.
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <Volume2 className="size-3.5" /> OGG Vorbis preview streams from local <span className="font-mono">outputs/</span>.
      </div>
    </div>
  );
}
