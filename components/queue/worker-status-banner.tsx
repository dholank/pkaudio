"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWorkerStatus } from "@/lib/worker/client";
import type { WorkerHealthStatus } from "@/lib/worker/health";

function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "unknown";
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

export function WorkerStatusBanner({ initialStatus }: { initialStatus: WorkerHealthStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setStatus(await fetchWorkerStatus());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (status.online) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100/85">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" />
          <div>
            <p className="font-medium text-emerald-100">Worker online: {status.summary.onlineWorkers} daemon(s), {status.summary.maxConcurrentJobs} concurrent slot(s).</p>
            <p className="mt-1 text-emerald-100/70">Active jobs: {status.summary.activeJobCount} • queued: {status.queueDepth.queued} • converted/upload-ready: {status.queueDepth.converted} • last seen {formatRelative(status.summary.newestLastSeenAt)}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/85">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-100">Worker offline — queued jobs will not process yet.</p>
          <p className="mt-1 text-amber-100/70">Run <span className="font-mono">npm run worker</span> in WSL2. Last heartbeat: {formatRelative(status.summary.newestLastSeenAt)}.</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
        <ServerCog /> Check again
      </Button>
    </div>
  );
}
