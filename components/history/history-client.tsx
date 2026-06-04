"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Copy, Download, ExternalLink, FileJson, FileSpreadsheet, Gauge, Music, RotateCcw, Search, Terminal, Trash2, Volume2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { JobLogDialog } from "@/components/queue/job-log-dialog";
import { StatusBadge } from "@/components/queue/status-badge";
import { WaveformLoudnessGraph } from "@/components/queue/waveform-loudness-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActionIconButton } from "@/components/shared/action-icon-button";
import { JobAudioMeta, JobOutputDiagnostics } from "@/components/jobs/job-audio-meta";
import { JobTitleBlock } from "@/components/jobs/job-title-block";
import { AUDIO_SAFETY_MODE_LABELS, formatHeadroomDb, formatTargetLufs } from "@/lib/audio/options";
import type { CredentialView } from "@/lib/credentials/types";
import { deleteJobRequest, fetchJobLogs, retryJobRequest } from "@/lib/jobs/client";
import type { JobLogView, JobView } from "@/lib/jobs/types";
import { formatBytes, formatDb, formatDuration, formatSpeed } from "@/lib/utils";

function outputDownloadHref(outputPath: string) {
  const cleaned = outputPath.replace(/^outputs\//, "");
  return `/api/outputs/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
}

function getParam(searchParams: URLSearchParams, key: string, fallback = "all") {
  return searchParams.get(key) || fallback;
}

function exportHref(format: "csv" | "json", searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("format", format);
  return `/api/history/export?${params.toString()}`;
}

async function copyText(value: string, label: string) {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied.`);
}

function moderationBadgeVariant(state: JobView["robloxModerationState"]): "secondary" | "success" | "destructive" | "warning" | "cyan" {
  if (state === "approved") return "success";
  if (state === "rejected" || state === "failed") return "destructive";
  if (state === "reviewing" || state === "unknown") return "warning";
  return "secondary";
}

const deletableStatuses = new Set(["queued", "converted", "done", "failed", "cancelled"]);

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function AudioMetaCompact({ job }: { job: JobView }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-500">
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

export function HistoryClient({ jobs, credentials }: { jobs: JobView[]; credentials: CredentialView[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedJob, setSelectedJob] = useState<JobView | null>(null);
  const [logs, setLogs] = useState<JobLogView[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [expandedWaveformId, setExpandedWaveformId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const selectedJobs = useMemo(() => jobs.filter((job) => selectedIds.has(job.id)), [jobs, selectedIds]);
  const allVisibleSelected = jobs.length > 0 && jobs.every((job) => selectedIds.has(job.id));

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.push(`/history?${next.toString()}`));
  }

  function applySearch() {
    updateParam("q", query.trim());
  }

  async function handleLogs(job: JobView) {
    setSelectedJob(job);
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const result = await fetchJobLogs(job.id);
      setLogs(result.logs);
      setSelectedJob(result.job);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleRetry(job: JobView) {
    try {
      await retryJobRequest(job.id);
      toast.success("Job re-queued.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry job.");
    }
  }

  function toggleJobSelection(jobId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const job of jobs) {
        if (checked) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  }

  async function copySelectedAssetIds() {
    const ids = selectedJobs.map((job) => job.assetId).filter(Boolean) as string[];
    if (!ids.length) {
      toast.error("Selected rows do not have Roblox asset IDs.");
      return;
    }
    await copyText(ids.join("\n"), `${ids.length} asset ID${ids.length === 1 ? "" : "s"}`);
  }

  async function deleteSelectedJobs() {
    const deletable = selectedJobs.filter((job) => deletableStatuses.has(job.status));
    if (!deletable.length) {
      toast.error("No selected rows are safe to delete. Active jobs must finish or be cancelled first.");
      return;
    }
    const skipped = selectedJobs.length - deletable.length;
    const confirmed = window.confirm(`Delete ${deletable.length} selected job${deletable.length === 1 ? "" : "s"}?${skipped ? `\n\n${skipped} active job${skipped === 1 ? "" : "s"} will be skipped.` : ""}\n\nLocal OGG outputs and temp folders will also be removed.`);
    if (!confirmed) return;

    try {
      for (const job of deletable) {
        await deleteJobRequest(job.id);
      }
      setSelectedIds(new Set());
      toast.success(`Deleted ${deletable.length} job${deletable.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected jobs.");
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Search, filter, and export SQLite job history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main filters */}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 size-4 text-zinc-600" />
                <Input
                  className="pl-9"
                  placeholder="Search title, URL, asset ID, error..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applySearch();
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={applySearch} disabled={isPending}>Search</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters((c) => !c)} className="gap-1">
                  {showAdvancedFilters ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  Filters
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Select value={getParam(params, "status")} onValueChange={(value) => updateParam("status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="downloading">Downloading</SelectItem>
                  <SelectItem value="probing">Probing</SelectItem>
                  <SelectItem value="converting">Converting</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="uploading">Uploading</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={getParam(params, "platform")} onValueChange={(value) => updateParam("platform", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="soundcloud">SoundCloud</SelectItem>
                  <SelectItem value="unknown">Unknown/local</SelectItem>
                </SelectContent>
              </Select>
              <Select value={getParam(params, "sort", "newest")} onValueChange={(value) => updateParam("sort", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="size">File size</SelectItem>
                  <SelectItem value="peak">Peak volume</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced filters — collapsible */}
            {showAdvancedFilters ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={getParam(params, "credentialId")} onValueChange={(value) => updateParam("credentialId", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All credentials</SelectItem>
                    {credentials.map((credential) => <SelectItem key={credential.id} value={credential.id}>{credential.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={getParam(params, "upload")} onValueChange={(value) => updateParam("upload", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All upload modes</SelectItem>
                    <SelectItem value="uploaded">Uploaded assets</SelectItem>
                    <SelectItem value="pending">Upload pending/failed</SelectItem>
                    <SelectItem value="local">Local only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={getParam(params, "moderation")} onValueChange={(value) => updateParam("moderation", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All moderation</SelectItem>
                    <SelectItem value="none">Not checked</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="failed">Check failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={getParam(params, "dateRange")} onValueChange={(value) => updateParam("dateRange", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Bulk actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">
                {jobs.length} job{/* grammar */}{jobs.length === 1 ? "" : "s"}
                {selectedJobs.length ? ` · ${selectedJobs.length} selected` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedJobs.length ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => void copySelectedAssetIds()}><Copy /> Copy IDs</Button>
                    <Button variant="outline" size="sm" className="border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10" onClick={() => void deleteSelectedJobs()}><Trash2 /> Delete</Button>
                  </>
                ) : null}
                <Button variant="outline" size="sm" asChild><a href={exportHref("csv", params)}><FileSpreadsheet /> CSV</a></Button>
                <Button variant="outline" size="sm" asChild><a href={exportHref("json", params)}><FileJson /> JSON</a></Button>
                <Button variant="ghost" size="sm" onClick={() => { setQuery(""); startTransition(() => router.push("/history")); }}>Reset</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table: 6 columns */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion History</CardTitle>
            <CardDescription>All SQLite jobs with audio settings, Roblox status, and conversion results.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-white/10 bg-white/[0.06] accent-cyan-400"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                      aria-label="Select all visible jobs"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Audio</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <Fragment key={job.id}>
                  <TableRow>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4 rounded border-white/10 bg-white/[0.06] accent-cyan-400"
                        checked={selectedIds.has(job.id)}
                        onChange={(event) => toggleJobSelection(job.id, event.target.checked)}
                        aria-label={`Select job ${job.id}`}
                      />
                    </TableCell>

                    {/* Title + Status */}
                    <TableCell>
                      <JobTitleBlock job={job} compact={false} showId />
                    </TableCell>

                    {/* Audio (compact) */}
                    <TableCell>
                      <JobAudioMeta job={job} compact />
                      <JobOutputDiagnostics
                        durationSec={job.outputDurationSec}
                        sizeBytes={job.outputSizeBytes}
                        peakDb={job.outputPeakDb}
                      />
                      {job.outputPath ? (
                        <button
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-400/70 hover:text-cyan-300"
                          onClick={() => setExpandedWaveformId((current) => (current === job.id ? null : job.id))}
                        >
                          <BarChart3 className="size-3" />
                          Waveform
                        </button>
                      ) : null}
                    </TableCell>

                    {/* Asset + Moderation */}
                    <TableCell>
                      {job.assetId ? (
                        <div className="font-mono text-xs text-emerald-200/90">{job.assetId}</div>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                      <div className="mt-1">
                        {job.robloxModerationState !== "none" ? (
                          <Badge variant={moderationBadgeVariant(job.robloxModerationState)} className="text-[10px]">
                            {job.robloxModerationState}
                          </Badge>
                        ) : job.uploadEnabled ? (
                          <span className="text-[11px] text-zinc-600">Uploading...</span>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default text-sm text-zinc-400">{relativeDate(job.updatedAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p>{new Date(job.updatedAt).toLocaleString()}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <ActionIconButton icon={Terminal} label="Logs" onClick={() => void handleLogs(job)} />

                        {job.assetId ? (
                          <>
                            <ActionIconButton icon={Copy} label="Copy ID" onClick={() => void copyText(job.assetId!, "Asset ID")} />
                            <ActionIconButton icon={ExternalLink} label="Open in Roblox" href={`https://create.roblox.com/store/asset/${job.assetId}`} />
                          </>
                        ) : null}

                        {job.outputPath ? (
                          <ActionIconButton icon={Download} label="Download OGG" href={outputDownloadHref(job.outputPath)} />
                        ) : null}

                        {job.status === "failed" || job.status === "cancelled" ? (
                          <ActionIconButton icon={RotateCcw} label="Retry" onClick={() => void handleRetry(job)} />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded waveform */}
                  {expandedWaveformId === job.id && job.outputPath ? (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-black/20">
                        <WaveformLoudnessGraph outputPath={job.outputPath} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
            {!jobs.length ? <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-sm text-zinc-500">No jobs match the current filters.</div> : null}
          </CardContent>
        </Card>

        <JobLogDialog open={logsOpen} job={selectedJob} logs={logs} loading={logsLoading} onOpenChange={setLogsOpen} />
      </div>
    </TooltipProvider>
  );
}
