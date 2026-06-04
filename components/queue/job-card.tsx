"use client";

import {
  BarChart3, Copy, Download, ExternalLink, FileAudio2, Gauge, KeyRound, Music, RotateCcw, ShieldCheck, Terminal, Trash2, Volume2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function IconBtn({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  asChild,
  className,
  children,
}: {
  icon: typeof Copy;
  label: string;
  onClick?: () => void;
  variant?: "outline" | "ghost";
  asChild?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const Wrapper = (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      asChild={asChild}
      className={`h-8 w-8 p-0 sm:w-auto sm:px-2.5 ${className ?? ""}`}
    >
      {asChild ? children : <Icon className="size-4" />}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{Wrapper}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs"><p>{label}</p></TooltipContent>
    </Tooltip>
  );
}

function CompactMeta({ job }: { job: JobView }) {
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
          {/* Header: status + platform + id */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-500">
                {job.sourcePlatform}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-600">
                {job.id.slice(0, 8)}
              </span>
            </div>
            <div className="font-mono text-sm text-zinc-300">{job.progress}%</div>
          </div>

          {/* Title */}
          <h3 className={`mt-2 break-words font-semibold text-white ${compact ? "text-sm" : "text-base md:truncate"}`}>
            {job.title ?? "Queued source"}
          </h3>
          <p className={`break-all font-mono text-zinc-600 ${compact ? "text-[11px] line-clamp-1" : "mt-1 text-xs md:truncate"}`}>
            {job.sourceUrl}
          </p>

          {/* Metadata */}
          <div className="mt-2">
            {compact ? <CompactMeta job={job} /> : <FullMeta job={job} />}
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
            <IconBtn icon={Terminal} label="Logs" onClick={() => onLogs?.(job)} />

            {isFailed || job.status === "cancelled" ? (
              <IconBtn icon={RotateCcw} label="Retry" onClick={() => onRetry?.(job)} />
            ) : null}

            {/* Roblox actions */}
            {job.robloxOperationId || job.robloxOperationPath ? (
              <IconBtn icon={ShieldCheck} label="Roblox status" onClick={() => onAuditRoblox?.(job)} />
            ) : null}

            {job.assetId ? (
              <IconBtn icon={ShieldCheck} label="Moderation check" onClick={() => onCheckRobloxModeration?.(job)} />
            ) : null}

            {/* Done actions */}
            {isDone && job.assetId ? (
              <>
                <IconBtn icon={Copy} label="Copy asset ID" onClick={() => void copyText(job.assetId!)} />
                <IconBtn icon={ExternalLink} label="Open in Roblox" asChild>
                  <a href={`https://create.roblox.com/store/asset/${job.assetId}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
                </IconBtn>
              </>
            ) : null}

            {job.outputPath ? (
              <IconBtn icon={Download} label="Download OGG" asChild>
                <a href={outputDownloadHref(job.outputPath)}><Download className="size-4" /></a>
              </IconBtn>
            ) : null}

            {/* Destructive */}
            {!isTerminal ? (
              <IconBtn icon={XCircle} label="Cancel" variant="outline" className="border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10" onClick={() => onCancel?.(job)} />
            ) : null}
            {canDelete ? (
              <IconBtn icon={Trash2} label="Delete" variant="outline" className="border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10" onClick={() => onDelete?.(job)} />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
