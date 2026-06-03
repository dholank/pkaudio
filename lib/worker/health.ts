import { randomUUID } from "node:crypto";
import os from "node:os";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { jobs, workerHeartbeats, type WorkerHeartbeatRow } from "@/lib/db/schema";

const WORKER_ONLINE_WINDOW_MS = Number(process.env.PKAUDIO_WORKER_ONLINE_WINDOW_MS ?? 15000);
const WORKER_PRUNE_AFTER_MS = Number(process.env.PKAUDIO_WORKER_PRUNE_AFTER_MS ?? 24 * 60 * 60 * 1000);

export type WorkerRuntimeInfo = {
  id: string;
  workerId: string;
  pid: number;
  hostname: string;
  startedAt: string;
  lastSeenAt: string;
  maxConcurrentJobs: number;
  retryCount: number;
  activeJobCount: number;
  claimedJobIds: string[];
  online: boolean;
  ageMs: number;
};

export type QueueDepthStats = {
  queued: number;
  active: number;
  converted: number;
  done: number;
  failed: number;
  cancelled: number;
};

export type WorkerHealthStatus = {
  online: boolean;
  onlineWindowMs: number;
  checkedAt: string;
  queueDepth: QueueDepthStats;
  workers: WorkerRuntimeInfo[];
  summary: {
    onlineWorkers: number;
    totalWorkers: number;
    activeJobCount: number;
    maxConcurrentJobs: number;
    oldestLastSeenAt: string | null;
    newestLastSeenAt: string | null;
  };
};

export function createWorkerIdentity() {
  const hostname = os.hostname();
  const pid = process.pid;
  const workerId = `${hostname}:${pid}`;
  return {
    id: randomUUID(),
    workerId,
    pid,
    hostname,
    startedAt: Date.now(),
  };
}

function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function parseClaimedJobIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toWorkerRuntimeInfo(row: WorkerHeartbeatRow, now: number): WorkerRuntimeInfo {
  const ageMs = Math.max(0, now - row.lastSeenAt);
  return {
    id: row.id,
    workerId: row.workerId,
    pid: row.pid,
    hostname: row.hostname,
    startedAt: iso(row.startedAt),
    lastSeenAt: iso(row.lastSeenAt),
    maxConcurrentJobs: row.maxConcurrentJobs,
    retryCount: row.retryCount,
    activeJobCount: row.activeJobCount,
    claimedJobIds: parseClaimedJobIds(row.claimedJobIds),
    online: ageMs <= WORKER_ONLINE_WINDOW_MS,
    ageMs,
  };
}

export async function upsertWorkerHeartbeat(input: {
  id: string;
  workerId: string;
  pid: number;
  hostname: string;
  startedAt: number;
  maxConcurrentJobs: number;
  retryCount: number;
  activeJobIds?: string[];
}) {
  const now = Date.now();
  const row = {
    id: input.id,
    workerId: input.workerId,
    pid: input.pid,
    hostname: input.hostname,
    startedAt: input.startedAt,
    lastSeenAt: now,
    maxConcurrentJobs: input.maxConcurrentJobs,
    retryCount: input.retryCount,
    activeJobCount: input.activeJobIds?.length ?? 0,
    claimedJobIds: JSON.stringify(input.activeJobIds ?? []),
  };

  getDb()
    .insert(workerHeartbeats)
    .values(row)
    .onConflictDoUpdate({
      target: workerHeartbeats.id,
      set: {
        workerId: row.workerId,
        pid: row.pid,
        hostname: row.hostname,
        startedAt: row.startedAt,
        lastSeenAt: row.lastSeenAt,
        maxConcurrentJobs: row.maxConcurrentJobs,
        retryCount: row.retryCount,
        activeJobCount: row.activeJobCount,
        claimedJobIds: row.claimedJobIds,
      },
    })
    .run();

  return toWorkerRuntimeInfo(row, now);
}

export async function removeWorkerHeartbeat(id: string) {
  getDb().delete(workerHeartbeats).where(eq(workerHeartbeats.id, id)).run();
}

export async function pruneOldWorkerHeartbeats(maxAgeMs = WORKER_PRUNE_AFTER_MS) {
  const cutoff = Date.now() - maxAgeMs;
  const result = getDb().delete(workerHeartbeats).where(sql`${workerHeartbeats.lastSeenAt} < ${cutoff}`).run();
  return { deleted: result.changes, cutoff: iso(cutoff), maxAgeMs };
}

export async function getQueueDepthStats(): Promise<QueueDepthStats> {
  const db = getDb();
  const activeStatuses = new Set<string>(["downloading", "probing", "converting", "uploading"]);
  const rows = db
    .select({ status: jobs.status, count: sql<number>`count(*)` })
    .from(jobs)
    .groupBy(jobs.status)
    .all();

  const depth: QueueDepthStats = { queued: 0, active: 0, converted: 0, done: 0, failed: 0, cancelled: 0 };
  for (const row of rows) {
    const count = Number(row.count ?? 0);
    if (row.status === "queued") depth.queued += count;
    else if (activeStatuses.has(row.status)) depth.active += count;
    else if (row.status === "converted") depth.converted += count;
    else if (row.status === "done") depth.done += count;
    else if (row.status === "failed") depth.failed += count;
    else if (row.status === "cancelled") depth.cancelled += count;
  }

  return depth;
}

export async function getActiveJobIds() {
  const activeStatuses = ["downloading", "probing", "converting", "uploading"] as const;
  return getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(inArray(jobs.status, activeStatuses))
    .all()
    .map((row) => row.id);
}

export async function getWorkerHealthStatus(): Promise<WorkerHealthStatus> {
  await pruneOldWorkerHeartbeats();

  const now = Date.now();
  const rows = getDb().select().from(workerHeartbeats).orderBy(desc(workerHeartbeats.lastSeenAt)).all();
  const workers = rows.map((row) => toWorkerRuntimeInfo(row, now));
  const onlineWorkers = workers.filter((worker) => worker.online);
  const queueDepth = await getQueueDepthStats();
  const lastSeenValues = workers.map((worker) => new Date(worker.lastSeenAt).getTime()).filter(Number.isFinite);

  return {
    online: onlineWorkers.length > 0,
    onlineWindowMs: WORKER_ONLINE_WINDOW_MS,
    checkedAt: iso(now),
    queueDepth,
    workers,
    summary: {
      onlineWorkers: onlineWorkers.length,
      totalWorkers: workers.length,
      activeJobCount: onlineWorkers.reduce((sum, worker) => sum + worker.activeJobCount, 0),
      maxConcurrentJobs: onlineWorkers.reduce((sum, worker) => sum + worker.maxConcurrentJobs, 0),
      oldestLastSeenAt: lastSeenValues.length ? iso(Math.min(...lastSeenValues)) : null,
      newestLastSeenAt: lastSeenValues.length ? iso(Math.max(...lastSeenValues)) : null,
    },
  };
}
