"use client";

import {
  BarChart3, Copy, Download, ExternalLink, FileAudio2, Gauge, KeyRound, Music, RotateCcw, ShieldCheck, Terminal, Trash2, Volume2, XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionIconButton } from "@/components/shared/action-icon-button";
import { JobAudioMeta, JobOutputDiagnostics } from "@/components/jobs/job-audio-meta";
import { JobTitleBlock } from "@/components/jobs/job-title-block";
import { AudioPreviewDiagnostics } from "@/components/queue/audio-preview-diagnostics";
import { StatusBadge } from "@/components/queue/status-badge";
import {
  AUDIO_SAFETY_MODE_LABELS,
  formatHeadroomDb,
  formatTargetLufs,
} from "@/lib/audio/options";
import { formatDb, formatSpeed } from "@/lib/utils";
import type { JobView } from "@/lib/jobs/types";

function outputDownloadHref(outputPath: string) {
  const cleaned = outputPath.replace(/^outputs\//, "");
  return `/api/outputs/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
}

async function copyText(value: string) {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
}

const deletableStatuses = new Set(["queued", "converted", "done", "failed", "cancelled"]);

function FullMeta({ job }: { job: JobView }) {
  return (
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs leading-5 text-zinc-500">
      <span>{formatSpeed(job.speed)}</span>
      <span>•</span>
      <span>gain {formatDb(job.amplifyDb)}</span>
      <span>•</span>
      <span>{job.quality.toUpperCase()}</span>
      <span>•</span>
      <span>{AUDIO_SAFETY_MODE_LABELS[job.audioSafetyMode]}</span>
      <span>•</span>
      <span>Attempt {job.attemptCount}/{job.maxAttempts}</span>
      <span>•</span>
      <span>{job.limiterEnabled ? `${formatTargetLufs(job.targetLufs)} → peak ≤ ${formatHeadroomDb(job.headroomDb)}` : "Limiter OFF"}</span>
      {job.credentialName ? (
        <>
          <span>•</span>
          <span className="inline-flex items-center gap-1"><KeyRound className="size-3" />{job.credentialName}</span>
        </>
      ) : null}
      {job.outputPath ? (
        <>
          <span>•</span>
          <span className="break-all font-mono">{job.outputPath}</span>
        </>
      ) : null}
    </div>
  );
}

export function JobCard({
  job,
  compact = false,
  onLogs,
  onCancel,
  onRetry,
  onDelete,
  onAuditRoblox,
  onCheckRobloxModeration,
}: {
  job: JobView;
  compact?: boolean;
  onLogs?: (job: JobView) => void;
  onCancel?: (job: JobView) => void;
  onRetry?: (job: JobView) => void;
  onDelete?: (job: JobView) => void;
  onAuditRoblox?: (job: JobView) => void;
  onCheckRobloxModeration?: (job: JobView) => void;
}) {
  const isFailed = job.status === "failed";
  const isDone = job.status === "done";
  const isTerminal = isDone || isFailed || job.status === "cancelled";
  const canDelete = deletableStatuses.has(job.status);

  return (
    <TooltipProvider>
      <Card className="transition-colors hover:border-white/[0.13]">
        <CardContent className={compact ? "p-3.5" : "p-5"}>
          {/* Title block */}
          {compact ? (
            <JobTitleBlock job={job} compact showId />
          ) : (
            <JobTitleBlock job={job} compact={false} showId />
          )}
          {compact ? (
            <div className="mt-1 text-right font-mono text-xs text-zinc-500">{job.progress}%</div>
          ) : null}

          {/* Non-compact progress inline */}

          {/* Metadata */}
          <div className="mt-2">
            {compact ? <JobAudioMeta job={job} compact /> : <FullMeta job={job} />}
          </div>

          {/* Error */}
          {job.error ? (
            <div className={`rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 ${compact ? "mt-2" : "mt-4"}`}>
              {job.error}
            </div>
          ) : null}

          {/* Compact Roblox info */}
          {compact && (job.assetId || job.robloxOperationId) ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.assetId ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                  <FileAudio2 className="size-3" /> {job.assetId}
                </span>
              ) : null}
              {job.robloxModerationState !== "none" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                  <ShieldCheck className="size-3" /> {job.robloxModerationState}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Full Roblox info box */}
          {!compact && (job.assetId || job.robloxOperationId) ? (
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm leading-6 text-emerald-100">
              {job.assetId ? <><span>Asset ID:</span><span className="break-all font-mono">{job.assetId}</span></> : null}
              {job.robloxOperationId ? <><span>•</span><span>Operation:</span><span className="break-all font-mono">{job.robloxOperationId}</span></> : null}
              <span>•</span>
              <span>Status: {job.robloxOperationStatus}</span>
              {job.assetId ? <><span>•</span><span>Moderation: {job.robloxModerationState}</span>{job.robloxModerationAttemptCount ? <span className="text-emerald-200/70">({job.robloxModerationAttemptCount} checks)</span> : null}</> : null}
            </div>
          ) : null}

          {/* Progress bar */}
          <div className={compact ? "mt-2" : "mt-4"}>
            <Progress value={job.progress} className="h-1.5" />
          </div>

          {/* Diagnostics */}
          {!compact ? <AudioPreviewDiagnostics job={job} /> : null}

          {/* Action buttons */}
          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-2" : "mt-4"}`}>
            {/* Core actions */}
            <ActionIconButton icon={Terminal} label="Logs" onClick={() => onLogs?.(job)} />

            {isFailed || job.status === "cancelled" ? (
              <ActionIconButton icon={RotateCcw} label="Retry" onClick={() => onRetry?.(job)} />
            ) : null}

            {job.robloxOperationId || job.robloxOperationPath ? (
              <ActionIconButton icon={ShieldCheck} label="Roblox status" onClick={() => onAuditRoblox?.(job)} />
            ) : null}

            {job.assetId ? (
              <ActionIconButton icon={ShieldCheck} label="Moderation check" onClick={() => onCheckRobloxModeration?.(job)} />
            ) : null}

            {isDone && job.assetId ? (
              <>
                <ActionIconButton icon={Copy} label="Copy asset ID" onClick={() => void copyText(job.assetId!)} />
                <ActionIconButton icon={ExternalLink} label="Open in Roblox" href={`https://create.roblox.com/store/asset/${job.assetId}`} />
              </>
            ) : null}

            {job.outputPath ? (
              <ActionIconButton icon={Download} label="Download OGG" href={outputDownloadHref(job.outputPath)} />
            ) : null}

            {!isTerminal ? (
              <ActionIconButton icon={XCircle} label="Cancel" tone="danger" onClick={() => onCancel?.(job)} />
            ) : null}
            {canDelete ? (
              <ActionIconButton icon={Trash2} label="Delete" tone="danger" onClick={() => onDelete?.(job)} />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
