"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Filter, History, ListMusic, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { JobLogDialog } from "@/components/queue/job-log-dialog";
import { QueueAudioCard } from "@/components/queue/queue-audio-card";
import { WorkerStatusBanner } from "@/components/queue/worker-status-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CredentialView } from "@/lib/credentials/types";
import { auditRobloxJobRequest, checkRobloxModerationRequest, fetchJobLogs, fetchJobs } from "@/lib/jobs/client";
import type { BatchView, JobLogView, JobView } from "@/lib/jobs/types";
import type { WorkerHealthStatus } from "@/lib/worker/health";

const liveStatuses = new Set(["queued", "downloading", "probing", "converting", "converted", "uploading"]);

function assetUri(assetId: string) {
  return `rbxassetid://${assetId}`;
}

function computeLatestStats(jobs: JobView[]) {
  const converting = jobs.filter((job) => ["queued", "downloading", "probing", "converting"].includes(job.status)).length;
  const converted = jobs.filter((job) => Boolean(job.outputPath) || ["converted", "uploading", "done"].includes(job.status)).length;
  const uploaded = jobs.filter((job) => Boolean(job.assetId)).length;
  const accepted = jobs.filter((job) => job.robloxModerationState === "approved").length;
  return [
    { label: "Converting", value: converting, variant: "cyan" as const },
    { label: "Converted", value: converted, variant: "success" as const },
    { label: "Uploaded", value: uploaded, variant: "success" as const },
    { label: "Accepted", value: accepted, variant: "success" as const },
  ];
}

async function copyText(value: string, label: string) {
  if (!navigator.clipboard) {
    toast.error("Clipboard is not available in this browser.");
    return;
  }
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied.`);
}

export function QueueClient({
  initialJobs,
  latestBatch,
  credentials,
  initialWorkerStatus,
}: {
  initialJobs: JobView[];
  latestBatch: BatchView | null;
  credentials: CredentialView[];
  initialWorkerStatus: WorkerHealthStatus;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [batch, setBatch] = useState<BatchView | null>(latestBatch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobView | null>(null);
  const [logs, setLogs] = useState<JobLogView[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => computeLatestStats(jobs), [jobs]);
  const hasLiveJobs = useMemo(() => jobs.some((job) => liveStatuses.has(job.status)), [jobs]);
  const uploadedJobs = useMemo(() => jobs.filter((job) => job.assetId), [jobs]);
  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesQuery = !q || [job.id, job.batchId, job.title, job.sourceUrl, job.assetId, job.credentialName, job.outputPath, job.error]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [jobs, query, statusFilter]);

  const refreshJobs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await fetchJobs({
        scope: "latest",
        limit: "200",
        status: statusFilter,
        q: query.trim(),
      });
      setJobs(result.jobs);
      setBatch(result.batch ?? null);
      if (!silent) toast.success("Latest queue refreshed.");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Failed to refresh latest queue.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    if (!hasLiveJobs) return;
    const timer = window.setInterval(() => void refreshJobs(true), 2500);
    return () => window.clearInterval(timer);
  }, [hasLiveJobs, refreshJobs]);

  async function handleLogs(job: JobView) {
    setSelectedJob(job);
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const result = await fetchJobLogs(job.id);
      setLogs(result.logs);
      setSelectedJob(result.job);
      setJobs((current) => current.map((item) => (item.id === result.job.id ? result.job : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAuditRoblox(job: JobView) {
    try {
      const result = await auditRobloxJobRequest(job.id);
      setJobs((current) => current.map((item) => (item.id === job.id ? result.job : item)));
      toast.success(`Roblox operation status: ${result.job.robloxOperationStatus}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check Roblox status.");
    }
  }

  async function handleCheckRobloxModeration(job: JobView) {
    try {
      const result = await checkRobloxModerationRequest(job.id);
      setJobs((current) => current.map((item) => (item.id === job.id ? result.job : item)));
      toast.success(`Roblox moderation status: ${result.job.robloxModerationState}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check Roblox moderation.");
    }
  }

  async function copyAssetId(job: JobView) {
    if (!job.assetId) return;
    await copyText(assetUri(job.assetId), "Asset ID");
  }

  async function copyTitleAsset(job: JobView) {
    if (!job.assetId) return;
    await copyText(`${job.title ?? "Untitled audio"} — ${assetUri(job.assetId)}`, "Title + asset ID");
  }

  async function copyAllAssetIds() {
    if (!uploadedJobs.length) {
      toast.error("No uploaded asset IDs in the latest queue yet.");
      return;
    }
    await copyText(uploadedJobs.map((job) => assetUri(job.assetId!)).join("\n"), `${uploadedJobs.length} asset ID${uploadedJobs.length === 1 ? "" : "s"}`);
    const skipped = jobs.length - uploadedJobs.length;
    if (skipped > 0) toast.info(`${skipped} latest queue item${skipped === 1 ? "" : "s"} skipped because upload is not done yet.`);
  }

  async function copyAllTitleAssets() {
    if (!uploadedJobs.length) {
      toast.error("No uploaded title + asset ID lines in the latest queue yet.");
      return;
    }
    await copyText(
      uploadedJobs.map((job) => `${job.title ?? "Untitled audio"} — ${assetUri(job.assetId!)}`).join("\n"),
      `${uploadedJobs.length} title + asset ID line${uploadedJobs.length === 1 ? "" : "s"}`,
    );
    const skipped = jobs.length - uploadedJobs.length;
    if (skipped > 0) toast.info(`${skipped} latest queue item${skipped === 1 ? "" : "s"} skipped because upload is not done yet.`);
  }

  return (
    <div className="space-y-6">
      <WorkerStatusBanner initialStatus={initialWorkerStatus} />

      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-[#111114] to-violet-500/10">
        <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">Latest batch only</Badge>
              {batch ? <Badge variant="secondary" className="font-mono">{batch.id.slice(0, 8)}</Badge> : null}
              {batch ? <Badge variant={batch.status === "done" ? "success" : batch.status === "failed" ? "destructive" : "warning"}>{batch.status}</Badge> : null}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">Latest Queue</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
              Queue sekarang fokus ke batch terbaru saja biar asset ID dan title audio terbaru gampang dicopy. Batch sebelumnya tetap aman di <Link href="/history" className="text-cyan-300 hover:text-cyan-200">History</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyAllAssetIds()} disabled={!uploadedJobs.length}><Copy /> Copy all IDs</Button>
            <Button onClick={() => void copyAllTitleAssets()} disabled={!uploadedJobs.length}><Copy /> Copy title + IDs</Button>
            <Button variant="ghost" asChild><Link href="/history"><History /> History</Link></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
              <Badge variant={stat.variant}>{stat.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="size-4 text-cyan-300" /> Latest Queue Filter</CardTitle>
          <CardDescription>Search dan filter ringan hanya untuk batch terbaru. Gunakan History untuk batch lama, export, dan pencarian lengkap.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-zinc-600" />
              <Input className="pl-9" placeholder="Search latest title, URL, asset ID..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All latest statuses</SelectItem>
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
            <Button variant="outline" onClick={() => void refreshJobs()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredJobs.length ? (
          filteredJobs.map((job) => (
            <QueueAudioCard
              key={job.id}
              job={job}
              onLogs={handleLogs}
              onCopyAssetId={copyAssetId}
              onCopyTitleAsset={copyTitleAsset}
              onAuditRoblox={handleAuditRoblox}
              onCheckRobloxModeration={handleCheckRobloxModeration}
            />
          ))
        ) : (
          <EmptyState icon={ListMusic} title="No latest queue items" description="Start a new batch from Convert. Older converted/uploaded audio is available in History." actionLabel="Go to Convert" />
        )}
      </div>

      <JobLogDialog open={logsOpen} job={selectedJob} logs={logs} loading={logsLoading} onOpenChange={setLogsOpen} />
    </div>
  );
}
