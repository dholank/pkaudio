"use client";

import { BarChart3, CheckCircle2, Copy, Download, ExternalLink, FileAudio2, Info, ShieldCheck, Terminal, UploadCloud, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QueueMiniWaveform } from "@/components/queue/waveform-loudness-graph";
import { AUDIO_SAFETY_MODE_LABELS, formatHeadroomDb, formatTargetLufs } from "@/lib/audio/options";
import type { JobView } from "@/lib/jobs/types";
import { formatBytes, formatDb, formatDuration, formatSpeed } from "@/lib/utils";

type QueueStatusItem = {
  label: string;
  variant: "secondary" | "success" | "destructive" | "warning" | "cyan";
  icon: typeof CheckCircle2;
};

function outputDownloadHref(outputPath: string) {
  const cleaned = outputPath.replace(/^outputs\//, "");
  return `/api/outputs/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
}

function assetUri(assetId: string) {
  return `rbxassetid://${assetId}`;
}

function convertStatus(job: JobView): QueueStatusItem {
  if (job.status === "failed") return { label: "Convert failed", variant: "destructive" as const, icon: XCircle };
  if (job.status === "cancelled") return { label: "Cancelled", variant: "secondary" as const, icon: XCircle };
  if (job.outputPath || ["converted", "uploading", "done"].includes(job.status)) return { label: "Converted", variant: "success" as const, icon: CheckCircle2 };
  if (["downloading", "probing", "converting"].includes(job.status)) return { label: "Converting", variant: "cyan" as const, icon: BarChart3 };
  return { label: "Queued", variant: "secondary" as const, icon: FileAudio2 };
}

function uploadStatus(job: JobView): QueueStatusItem {
  if (!job.uploadEnabled) return { label: "Local only", variant: "secondary" as const, icon: FileAudio2 };
  if (job.assetId) return { label: "Uploaded", variant: "success" as const, icon: UploadCloud };
  if (job.status === "uploading") return { label: "Uploading", variant: "cyan" as const, icon: UploadCloud };
  if (job.robloxOperationStatus === "failed" || job.status === "failed") return { label: "Upload failed", variant: "destructive" as const, icon: XCircle };
  return { label: "Upload pending", variant: "warning" as const, icon: UploadCloud };
}

function moderationCheckSuffix(job: JobView) {
  if (job.robloxModerationAttemptCount <= 0) return "";
  return ` · ${job.robloxModerationAttemptCount} check${job.robloxModerationAttemptCount === 1 ? "" : "s"}`;
}

function moderationStatus(job: JobView): QueueStatusItem {
  const checks = moderationCheckSuffix(job);
  switch (job.robloxModerationState) {
    case "approved":
      return { label: `Accepted${checks}`, variant: "success" as const, icon: ShieldCheck };
    case "reviewing":
      return { label: `Reviewing${checks}`, variant: "warning" as const, icon: ShieldCheck };
    case "rejected":
      return { label: `Rejected${checks}`, variant: "destructive" as const, icon: XCircle };
    case "failed":
      return { label: `Moderation retrying${checks}`, variant: "warning" as const, icon: Info };
    case "unknown":
      return { label: `Moderation unknown${checks}`, variant: "warning" as const, icon: Info };
    case "none":
    default:
      return { label: `Not checked${checks}`, variant: "secondary" as const, icon: ShieldCheck };
  }
}

function StatusChip({ item }: { item: QueueStatusItem }) {
  const Icon = item.icon;
  return (
    <Badge variant={item.variant} className="gap-1.5 whitespace-nowrap px-2 py-1 text-[11px] uppercase tracking-[0.12em]">
      <Icon className="size-3" /> {item.label}
    </Badge>
  );
}

export function QueueAudioCard({
  job,
  onLogs,
  onCopyAssetId,
  onCopyTitleAsset,
  onAuditRoblox,
  onCheckRobloxModeration,
}: {
  job: JobView;
  onLogs?: (job: JobView) => void;
  onCopyAssetId?: (job: JobView) => void;
  onCopyTitleAsset?: (job: JobView) => void;
  onAuditRoblox?: (job: JobView) => void;
  onCheckRobloxModeration?: (job: JobView) => void;
}) {
  const title = job.title ?? "Queued source";
  const normalSpeed = job.speed ? (1 / job.speed).toFixed(2) : "—";
  const platformLabel = job.sourcePlatform === "youtube" ? "YouTube" : job.sourcePlatform === "soundcloud" ? "SoundCloud" : "Source";
  const canCheckRoblox = Boolean(job.robloxOperationId || job.robloxOperationPath);
  const canCheckModeration = Boolean(job.assetId);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-card transition hover:border-cyan-500/20 hover:bg-white/[0.05] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/25 via-cyan-500/10 to-emerald-500/10 sm:size-24">
          <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-black/25 text-cyan-100">
            <FileAudio2 className="size-6" />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip item={convertStatus(job)} />
            <StatusChip item={uploadStatus(job)} />
            <StatusChip item={moderationStatus(job)} />
            <Badge variant="outline" className="whitespace-nowrap px-2 py-1 text-[11px] uppercase tracking-[0.12em]">{platformLabel}</Badge>
          </div>

          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold leading-snug text-white">{title}</h3>
            <a className="mt-1 block break-all font-mono text-xs text-cyan-300/85 hover:text-cyan-200" href={job.sourceUrl} target="_blank" rel="noreferrer">
              {job.sourceUrl}
            </a>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-zinc-500">
            <span>Speed: <b className="font-mono text-violet-200">{formatSpeed(job.speed)}</b></span>
            <span>Gain: <b className="font-mono text-violet-200">{formatDb(job.amplifyDb)}</b></span>
            <span>Quality: <b className="font-mono text-violet-200">{job.quality.toUpperCase()}</b></span>
            <span>{AUDIO_SAFETY_MODE_LABELS[job.audioSafetyMode]}</span>
            <span>{job.limiterEnabled ? `${formatTargetLufs(job.targetLufs)} → peak ≤ ${formatHeadroomDb(job.headroomDb)}` : "Limiter OFF"}</span>
            {job.outputDurationSec !== null ? <span>{formatDuration(job.outputDurationSec)}</span> : null}
            {job.outputSizeBytes !== null ? <span>{formatBytes(job.outputSizeBytes)}</span> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
              Normal Speed (in-game): <span className="font-mono text-white">{normalSpeed}</span>
              <Info className="size-3.5 text-zinc-500" />
            </div>
            {job.assetId ? (
              <button className="break-all rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 font-mono text-xs text-cyan-200 transition hover:bg-cyan-500/15" onClick={() => onCopyAssetId?.(job)}>
                {assetUri(job.assetId)}
              </button>
            ) : null}
          </div>

          {job.status !== "done" && job.progress < 100 ? (
            <div className="space-y-1.5">
              <Progress value={job.progress} />
              <p className="font-mono text-[11px] text-zinc-600">{job.progress}% • attempt {job.attemptCount}/{job.maxAttempts}</p>
            </div>
          ) : null}

          {job.error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{job.error}</div> : null}
        </div>

        {job.outputPath ? (
          <div className="w-full shrink-0 lg:w-64 xl:w-72">
            <QueueMiniWaveform outputPath={job.outputPath} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 [&>a]:h-8 [&>button]:h-8">
        <Button variant="outline" size="sm" onClick={() => onLogs?.(job)}><Terminal /> Logs</Button>
        {job.assetId ? <Button variant="outline" size="sm" onClick={() => onCopyAssetId?.(job)}><Copy /> Copy Code</Button> : null}
        {job.assetId ? <Button variant="outline" size="sm" onClick={() => onCopyTitleAsset?.(job)}><Copy /> Title + Code</Button> : null}
        {canCheckRoblox ? <Button variant="outline" size="sm" onClick={() => onAuditRoblox?.(job)}><ShieldCheck /> Roblox</Button> : null}
        {canCheckModeration ? <Button variant="outline" size="sm" onClick={() => onCheckRobloxModeration?.(job)}><ShieldCheck /> Moderation</Button> : null}
        {job.assetId ? <Button variant="outline" size="sm" asChild><a href={`https://create.roblox.com/store/asset/${job.assetId}`} target="_blank" rel="noreferrer"><ExternalLink /> Asset</a></Button> : null}
        {job.outputPath ? <Button variant="ghost" size="sm" asChild><a href={outputDownloadHref(job.outputPath)}><Download /> OGG</a></Button> : null}
      </div>
    </article>
  );
}
