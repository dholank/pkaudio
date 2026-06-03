"use client";

import { Copy, Download, ExternalLink, RotateCcw, ShieldCheck, Terminal, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AudioPreviewDiagnostics } from "@/components/queue/audio-preview-diagnostics";
import { StatusBadge } from "@/components/queue/status-badge";
import { AUDIO_SAFETY_MODE_LABELS, formatHeadroomDb } from "@/lib/audio/options";
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
    <Card className="transition-colors hover:border-white/[0.13]">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-500">
                {job.sourcePlatform}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-zinc-600">
                {job.id.slice(0, 8)}
              </span>
            </div>
            <h3 className="mt-3 truncate text-base font-semibold text-white">{job.title ?? "Queued source"}</h3>
            <p className="mt-1 truncate font-mono text-xs text-zinc-600">{job.sourceUrl}</p>
          </div>
          <div className="font-mono text-sm text-zinc-300">{job.progress}%</div>
        </div>

        <div className="mt-4">
          <Progress value={job.progress} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{formatSpeed(job.speed)}</span>
          <span>•</span>
          <span>{formatDb(job.amplifyDb)}</span>
          <span>•</span>
          <span>{job.quality.toUpperCase()}</span>
          <span>•</span>
          <span>{AUDIO_SAFETY_MODE_LABELS[job.audioSafetyMode]}</span>
          <span>•</span>
          <span>Attempt {job.attemptCount}/{job.maxAttempts}</span>
          <span>•</span>
          <span>{job.limiterEnabled ? `Limiter ${formatHeadroomDb(job.headroomDb)}` : "Limiter OFF"}</span>
          {job.credentialName ? (
            <>
              <span>•</span>
              <span>{job.credentialName}</span>
            </>
          ) : null}
          {job.outputPath ? (
            <>
              <span>•</span>
              <span className="font-mono">{job.outputPath}</span>
            </>
          ) : null}
        </div>

        {job.error ? (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {job.error}
          </div>
        ) : null}

        {job.assetId || job.robloxOperationId ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {job.assetId ? <><span>Asset ID:</span><span className="font-mono">{job.assetId}</span></> : null}
            {job.robloxOperationId ? <><span>•</span><span>Operation:</span><span className="font-mono">{job.robloxOperationId}</span></> : null}
            <span>•</span>
            <span>Status: {job.robloxOperationStatus}</span>
            {job.assetId ? <><span>•</span><span>Moderation: {job.robloxModerationState}</span>{job.robloxModerationAttemptCount ? <span className="text-emerald-200/70">({job.robloxModerationAttemptCount} checks)</span> : null}</> : null}
          </div>
        ) : null}

        <AudioPreviewDiagnostics job={job} />

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onLogs?.(job)}>
            <Terminal /> Logs
          </Button>
          {isFailed || job.status === "cancelled" ? (
            <Button variant="outline" size="sm" onClick={() => onRetry?.(job)}>
              <RotateCcw /> Retry
            </Button>
          ) : null}
          {job.robloxOperationId || job.robloxOperationPath ? (
            <Button variant="outline" size="sm" onClick={() => onAuditRoblox?.(job)}>
              <ShieldCheck /> Check Roblox
            </Button>
          ) : null}
          {job.assetId ? (
            <Button variant="outline" size="sm" onClick={() => onCheckRobloxModeration?.(job)}>
              <ShieldCheck /> Check Moderation
            </Button>
          ) : null}
          {isDone && job.assetId ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void copyText(job.assetId!)}>
                <Copy /> Copy ID
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://create.roblox.com/store/asset/${job.assetId}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open Asset
                </a>
              </Button>
            </>
          ) : null}
          {job.outputPath ? (
            <Button variant="outline" size="sm" asChild>
              <a href={outputDownloadHref(job.outputPath)}>
                <Download /> Download OGG
              </a>
            </Button>
          ) : null}
          {!isTerminal ? (
            <Button variant="ghost" size="sm" onClick={() => onCancel?.(job)}>
              <XCircle /> Cancel
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="ghost" size="sm" className="text-rose-200 hover:text-rose-100" onClick={() => onDelete?.(job)}>
              <Trash2 /> Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
