"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock, Cpu, RefreshCw, ServerCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function WorkerHealthCard({ initialStatus }: { initialStatus: WorkerHealthStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [refreshing, setRefreshing] = useState(false);
  const hasOnlineWorker = status.online;

  const headline = useMemo(() => {
    if (status.summary.onlineWorkers > 1) return `${status.summary.onlineWorkers} workers online`;
    if (status.summary.onlineWorkers === 1) return "1 worker online";
    return "Worker offline";
  }, [status.summary.onlineWorkers]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const next = await fetchWorkerStatus();
      setStatus(next);
      if (!silent) toast.success("Worker status refreshed.");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Failed to refresh worker status.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><ServerCog className="size-4 text-cyan-300" /> Worker Health</CardTitle>
            <CardDescription>Live heartbeat from local WSL2 worker daemon.</CardDescription>
          </div>
          <Badge variant={hasOnlineWorker ? "success" : "warning"}>{headline}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500"><Activity className="size-4" /> Active jobs</p>
            <p className="mt-2 text-2xl font-semibold text-white">{status.summary.activeJobCount}</p>
            <p className="text-xs text-zinc-500">Queue active: {status.queueDepth.active} • queued: {status.queueDepth.queued} • converted: {status.queueDepth.converted}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500"><Cpu className="size-4" /> Capacity</p>
            <p className="mt-2 text-2xl font-semibold text-white">{status.summary.maxConcurrentJobs || 0}</p>
            <p className="text-xs text-zinc-500">Configured concurrent slots online</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/45">
          {status.workers.length ? (
            status.workers.map((worker) => (
              <div key={worker.id} className="border-b border-white/10 p-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-white">{worker.workerId}</p>
                    <p className="mt-1 text-xs text-zinc-500">PID {worker.pid} • {worker.hostname} • started {formatRelative(worker.startedAt)}</p>
                  </div>
                  <Badge variant={worker.online ? "success" : "secondary"}>{worker.online ? "online" : "stale"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                  <span><Clock className="mr-1 inline size-3" /> Last seen {formatRelative(worker.lastSeenAt)}</span>
                  <span>Concurrency {worker.maxConcurrentJobs}</span>
                  <span>Active {worker.activeJobCount}</span>
                </div>
                {worker.claimedJobIds.length > 0 ? (
                  <p className="mt-2 truncate font-mono text-xs text-cyan-200/80">Jobs: {worker.claimedJobIds.join(", ")}</p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="p-4 text-sm leading-6 text-zinc-400">
              No heartbeat yet. Start the daemon with <span className="font-mono text-zinc-200">npm run worker</span> from WSL2.
            </div>
          )}
        </div>

        {!hasOnlineWorker ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/85">
            Queue jobs and converted/upload-ready jobs will stay pending while the worker is offline. Run <span className="font-mono">npm run worker</span> to process downloads, conversion, and serial Roblox upload.
          </div>
        ) : null}

        <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh worker status
        </Button>
      </CardContent>
    </Card>
  );
}
