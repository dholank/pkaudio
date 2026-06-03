"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Copy, Download, ExternalLink, FileJson, FileSpreadsheet, RotateCcw, Search, Terminal, Trash2 } from "lucide-react";
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>History Filters</CardTitle>
          <CardDescription>Search, filter, sort, and export SQLite job history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-zinc-600" />
              <Input
                className="pl-9"
                placeholder="Search title, URL, asset ID, job ID, moderation, credential, error..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            </div>
            <Button variant="outline" onClick={applySearch} disabled={isPending}>Apply</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">Showing {jobs.length} job{jobs.length === 1 ? "" : "s"}. {selectedJobs.length ? `${selectedJobs.length} selected.` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {selectedJobs.length ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => void copySelectedAssetIds()}><Copy /> Copy selected IDs</Button>
                  <Button variant="ghost" size="sm" className="text-rose-200 hover:text-rose-100" onClick={() => void deleteSelectedJobs()}><Trash2 /> Delete selected</Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" asChild><a href={exportHref("csv", params)}><FileSpreadsheet /> Export CSV</a></Button>
              <Button variant="outline" size="sm" asChild><a href={exportHref("json", params)}><FileJson /> Export JSON</a></Button>
              <Button variant="ghost" size="sm" onClick={() => { setQuery(""); startTransition(() => router.push("/history")); }}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversion History</CardTitle>
          <CardDescription>Real SQLite jobs with converted OGG diagnostics, upload state, and moderation data.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    className="size-4 rounded border-white/10 bg-white/[0.06] accent-cyan-400"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                    aria-label="Select all visible jobs"
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Moderation</TableHead>
                <TableHead>Diagnostics</TableHead>
                <TableHead>Asset ID</TableHead>
                <TableHead>Date</TableHead>
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
                  <TableCell>
                    <div className="max-w-[360px] truncate font-medium text-white">{job.title ?? "Queued source"}</div>
                    <div className="max-w-[360px] truncate font-mono text-xs text-zinc-600">{job.sourceUrl}</div>
                    <div className="mt-1 font-mono text-[11px] text-zinc-700">{job.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{job.sourcePlatform}</Badge></TableCell>
                  <TableCell className="text-zinc-400">
                    <div>{formatSpeed(job.speed)} • gain {formatDb(job.amplifyDb)} • {job.quality.toUpperCase()}</div>
                    <div className="mt-1 text-xs text-zinc-600">{AUDIO_SAFETY_MODE_LABELS[job.audioSafetyMode]} • {job.limiterEnabled ? `${formatTargetLufs(job.targetLufs)} → peak ≤ ${formatHeadroomDb(job.headroomDb)}` : "Limiter OFF"}</div>
                    <div className="mt-1 text-xs text-zinc-600">Attempt {job.attemptCount}/{job.maxAttempts}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={job.status} /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={moderationBadgeVariant(job.robloxModerationState)}>{job.robloxModerationState}</Badge>
                      <div className="text-xs text-zinc-600">
                        {job.robloxModerationCheckedAt ? new Date(job.robloxModerationCheckedAt).toLocaleString() : "Not checked"}
                        {job.robloxModerationAttemptCount ? ` • ${job.robloxModerationAttemptCount} checks` : ""}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    <div>{formatDuration(job.outputDurationSec)} • {job.outputSizeBytes !== null ? formatBytes(job.outputSizeBytes) : "—"}</div>
                    <div className="font-mono">Peak {job.outputPeakDb !== null ? `${job.outputPeakDb.toFixed(2)} dBFS` : "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-zinc-400">{job.assetId ?? "—"}</TableCell>
                  <TableCell className="text-zinc-500">{new Date(job.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => void handleLogs(job)}><Terminal /></Button>
                      {job.assetId ? <Button variant="outline" size="sm" onClick={() => void copyText(job.assetId!, "Asset ID")}><Copy /></Button> : null}
                      {job.assetId ? <Button variant="outline" size="sm" asChild><a href={`https://create.roblox.com/store/asset/${job.assetId}`} target="_blank" rel="noreferrer"><ExternalLink /></a></Button> : null}
                      {job.outputPath ? (
                        <Button
                          variant={expandedWaveformId === job.id ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setExpandedWaveformId((current) => (current === job.id ? null : job.id))}
                          aria-label="Toggle waveform graph"
                        >
                          <BarChart3 />
                        </Button>
                      ) : null}
                      {job.outputPath ? <Button variant="outline" size="sm" asChild><a href={outputDownloadHref(job.outputPath)}><Download /></a></Button> : null}
                      {job.status === "failed" || job.status === "cancelled" ? <Button variant="ghost" size="sm" onClick={() => void handleRetry(job)}><RotateCcw /></Button> : null}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedWaveformId === job.id && job.outputPath ? (
                  <TableRow>
                    <TableCell colSpan={10} className="bg-black/20">
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
  );
}
