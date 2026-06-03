"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, ListMusic, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { JobCard } from "@/components/queue/job-card";
import { JobLogDialog } from "@/components/queue/job-log-dialog";
import { WorkerStatusBanner } from "@/components/queue/worker-status-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CredentialView } from "@/lib/credentials/types";
import { auditRobloxJobRequest, cancelJobRequest, checkRobloxModerationRequest, deleteJobRequest, fetchJobLogs, fetchJobs, retryJobRequest } from "@/lib/jobs/client";
import type { JobLogView, JobView } from "@/lib/jobs/types";
import type { WorkerHealthStatus } from "@/lib/worker/health";

function computeStats(jobs: JobView[]) {
  const active = jobs.filter((job) => ["downloading", "probing", "converting", "uploading"].includes(job.status)).length;
  const converted = jobs.filter((job) => job.status === "converted").length;
  const done = jobs.filter((job) => job.status === "done").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const waiting = jobs.filter((job) => job.status === "queued").length;
  return [
    { label: "Active", value: active, variant: "cyan" as const },
    { label: "Converted", value: converted, variant: "warning" as const },
    { label: "Done", value: done, variant: "success" as const },
    { label: "Failed", value: failed, variant: "destructive" as const },
    { label: "Queued", value: waiting, variant: "secondary" as const },
  ];
}

const activeStatuses = new Set(["queued", "downloading", "probing", "converting", "converted", "uploading"]);

export function QueueClient({ initialJobs, credentials, initialWorkerStatus }: { initialJobs: JobView[]; credentials: CredentialView[]; initialWorkerStatus: WorkerHealthStatus }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [statusFilter, setStatusFilter] = useState("all");
  const [credentialFilter, setCredentialFilter] = useState("all");
  const [uploadFilter, setUploadFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobView | null>(null);
  const [logs, setLogs] = useState<JobLogView[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => computeStats(jobs), [jobs]);
  const hasLiveJobs = useMemo(() => jobs.some((job) => activeStatuses.has(job.status)), [jobs]);
  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesCredential = credentialFilter === "all" || job.credentialId === credentialFilter;
      const matchesUpload =
        uploadFilter === "all" ||
        (uploadFilter === "uploaded" && Boolean(job.assetId)) ||
        (uploadFilter === "pending" && job.uploadEnabled && !job.assetId) ||
        (uploadFilter === "local" && !job.uploadEnabled);
      const matchesQuery = !q || [job.id, job.batchId, job.title, job.sourceUrl, job.assetId, job.credentialName, job.outputPath, job.error].filter(Boolean).some((value) => value?.toLowerCase().includes(q));
      return matchesStatus && matchesCredential && matchesUpload && matchesQuery;
    });
  }, [credentialFilter, jobs, query, statusFilter, uploadFilter]);

  const refreshJobs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await fetchJobs({
        limit: "200",
        status: statusFilter,
        credentialId: credentialFilter,
        upload: uploadFilter,
        q: query.trim(),
      });
      setJobs(result.jobs);
      if (!silent) toast.success("Queue refreshed.");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Failed to refresh jobs.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [credentialFilter, query, statusFilter, uploadFilter]);

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

  async function handleCancel(job: JobView) {
    try {
      const result = await cancelJobRequest(job.id);
      setJobs((current) => current.map((item) => (item.id === job.id ? result.job : item)));
      toast.success("Job cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel job.");
    }
  }

  async function handleRetry(job: JobView) {
    try {
      const result = await retryJobRequest(job.id);
      setJobs((current) => current.map((item) => (item.id === job.id ? result.job : item)));
      toast.success("Job re-queued.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry job.");
    }
  }

  async function handleDelete(job: JobView) {
    const confirmed = window.confirm(
      `Delete this job from the queue?${job.outputPath ? "\n\nThe local OGG output and temp folder will also be removed." : ""}`
    );
    if (!confirmed) return;

    try {
      await deleteJobRequest(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (selectedJob?.id === job.id) {
        setSelectedJob(null);
        setLogsOpen(false);
        setLogs([]);
      }
      toast.success("Job deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job.");
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

  return (
    <div className="space-y-6">
      <WorkerStatusBanner initialStatus={initialWorkerStatus} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-zinc-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-semibold text-white">{stat.value}</p>
              </div>
              <Badge variant={stat.variant}>{stat.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="size-4 text-cyan-300" /> Filters</CardTitle>
          <CardDescription>Run <span className="font-mono text-zinc-300">npm run worker</span> in WSL2 to convert queued jobs, then upload converted jobs serially. Live statuses auto-refresh while jobs are active.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-zinc-600" />
              <Input className="pl-9" placeholder="Search title, URL, asset ID, output path, error..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void refreshJobs()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={credentialFilter} onValueChange={setCredentialFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All credentials</SelectItem>
                {credentials.map((credential) => <SelectItem key={credential.id} value={credential.id}>{credential.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={uploadFilter} onValueChange={setUploadFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All upload modes</SelectItem>
                <SelectItem value="uploaded">Uploaded assets</SelectItem>
                <SelectItem value="pending">Upload pending/failed</SelectItem>
                <SelectItem value="local">Local only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("queued")}>Queued</Button>
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("converted")}>Converted</Button>
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("uploading")}>Uploading</Button>
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("failed")}>Failed</Button>
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setCredentialFilter("all"); setUploadFilter("all"); setQuery(""); }}>Reset filters</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredJobs.length ? (
          filteredJobs.map((job) => <JobCard key={job.id} job={job} onLogs={handleLogs} onCancel={handleCancel} onRetry={handleRetry} onDelete={handleDelete} onAuditRoblox={handleAuditRoblox} onCheckRobloxModeration={handleCheckRobloxModeration} />)
        ) : (
          <EmptyState icon={ListMusic} title="No jobs found" description="Start a batch from Convert to create queued jobs." actionLabel="Go to Convert" />
        )}
      </div>

      <JobLogDialog open={logsOpen} job={selectedJob} logs={logs} loading={logsLoading} onOpenChange={setLogsOpen} />
    </div>
  );
}
