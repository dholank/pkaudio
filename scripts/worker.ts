#!/usr/bin/env tsx

import { loadLocalEnv } from "@/lib/system/env";
import { claimNextConvertedUploadJob, claimNextQueuedJobs, recoverStaleJobs } from "@/lib/jobs/repository";
import { getSettings } from "@/lib/settings/repository";
import { getSystemChecks } from "@/lib/system/checks";
import type { JobView } from "@/lib/jobs/types";
import { createWorkerIdentity, removeWorkerHeartbeat, upsertWorkerHeartbeat } from "@/lib/worker/health";
import { processMediaJob } from "@/lib/worker/media";
import { pollDueRobloxModerationJobs } from "@/lib/worker/moderation";
import { processRobloxUploadJob } from "@/lib/worker/upload";

loadLocalEnv();

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.PKAUDIO_WORKER_INTERVAL_MS ?? 3000);
const recoveryIntervalMs = Number(process.env.PKAUDIO_WORKER_RECOVERY_INTERVAL_MS ?? 60000);
const staleJobMaxAgeMs = Number(process.env.PKAUDIO_WORKER_STALE_JOB_MS ?? 30 * 60 * 1000);
let lastRecoveryAt = 0;
const workerIdentity = createWorkerIdentity();
let runningUpload: Promise<boolean> | null = null;
let runningUploadJobId: string | null = null;

async function assertDependencies() {
  const checks = await getSystemChecks();
  const missing = Object.values(checks).filter((check) => !check.ok);
  if (missing.length) {
    for (const check of missing) {
      console.error(`[worker] missing ${check.command}: ${check.error}`);
    }
    throw new Error("Missing required worker binaries.");
  }
}

async function recoverIfDue(force = false) {
  const now = Date.now();
  if (!force && now - lastRecoveryAt < recoveryIntervalMs) return;
  lastRecoveryAt = now;

  const recovery = await recoverStaleJobs({ maxAgeMs: staleJobMaxAgeMs });
  if (recovery.checked > 0) {
    console.log(
      `[worker] stale recovery checked=${recovery.checked} requeued=${recovery.requeued} failed=${recovery.failed} cutoff=${recovery.cutoff}`,
    );
  }
}

function clampConcurrency(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(4, Math.floor(value)));
}

function activeUploadJobIds() {
  return runningUploadJobId ? [runningUploadJobId] : [];
}

async function beat(maxConcurrentJobs: number, retryCount: number, activeJobIds: string[] = []) {
  await upsertWorkerHeartbeat({
    ...workerIdentity,
    maxConcurrentJobs,
    retryCount,
    activeJobIds: [...activeJobIds, ...activeUploadJobIds()],
  });
}

async function processClaimedJob(job: JobView) {
  console.log(`[worker] converting ${job.id} attempt=${job.attemptCount}/${job.maxAttempts} ${job.sourceUrl}`);
  const ok = await processMediaJob(job);
  console.log(`[worker] ${ok ? "converted-or-done" : "failed-or-requeued"} ${job.id}`);
  return ok;
}

async function processUploadQueue(options: { wait?: boolean } = {}) {
  if (runningUpload) {
    if (options.wait) return runningUpload;
    return false;
  }

  const uploadJob = await claimNextConvertedUploadJob();
  if (!uploadJob) return false;

  console.log(`[worker] uploading converted job ${uploadJob.id}`);
  runningUploadJobId = uploadJob.id;
  runningUpload = processRobloxUploadJob(uploadJob)
    .then((ok) => {
      console.log(`[worker] upload ${ok ? "done" : "failed"} ${uploadJob.id}`);
      return ok;
    })
    .catch((error) => {
      console.error(`[worker] upload crashed ${uploadJob.id}:`, error instanceof Error ? error.message : error);
      return false;
    })
    .finally(() => {
      runningUpload = null;
      runningUploadJobId = null;
    });

  if (options.wait) return runningUpload;
  return true;
}

async function pollModerationQueue() {
  const moderation = await pollDueRobloxModerationJobs();
  if (moderation.checked > 0 || moderation.failed > 0) {
    console.log(`[worker] moderation checked=${moderation.checked} final=${moderation.final} failed=${moderation.failed}`);
  }
  return moderation;
}

async function tick() {
  await recoverIfDue();
  const settings = await getSettings();
  const maxConcurrentJobs = clampConcurrency(settings.maxConcurrentJobs);
  const retryCount = Math.max(0, settings.retryCount);
  const maxAttempts = Math.max(1, retryCount + 1);
  await beat(maxConcurrentJobs, retryCount);
  const claimed = await claimNextQueuedJobs(maxConcurrentJobs, { maxAttempts });

  if (!claimed.length) {
    const uploadStartedOrDone = await processUploadQueue({ wait: once });
    if (!uploadStartedOrDone && !runningUpload) console.log(`[worker] no queued conversion jobs or upload-ready jobs (concurrency=${maxConcurrentJobs}, maxAttempts=${maxAttempts})`);
    await pollModerationQueue();
    await beat(maxConcurrentJobs, retryCount);
    return uploadStartedOrDone || Boolean(runningUpload);
  }

  console.log(`[worker] claimed ${claimed.length}/${maxConcurrentJobs} job(s), maxAttempts=${maxAttempts}`);
  await beat(maxConcurrentJobs, retryCount, claimed.map((job) => job.id));
  await Promise.allSettled(claimed.map(processClaimedJob));
  await processUploadQueue({ wait: once });
  await pollModerationQueue();
  await beat(maxConcurrentJobs, retryCount);
  return true;
}

async function cleanup() {
  await removeWorkerHeartbeat(workerIdentity.id);
}

process.once("SIGINT", () => {
  void cleanup().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void cleanup().finally(() => process.exit(0));
});

async function main() {
  await assertDependencies();
  const settings = await getSettings();
  console.log(`[worker] PKAudio media worker started (${once ? "once" : `interval ${intervalMs}ms`})`);
  console.log(`[worker] concurrency=${clampConcurrency(settings.maxConcurrentJobs)}, retryCount=${settings.retryCount}`);
  console.log(`[worker] stale recovery max age ${staleJobMaxAgeMs}ms, check interval ${recoveryIntervalMs}ms`);
  await beat(clampConcurrency(settings.maxConcurrentJobs), Math.max(0, settings.retryCount));
  await recoverIfDue(true);

  if (once) {
    await tick();
    await cleanup();
    return;
  }

  while (true) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  void cleanup().finally(() => process.exit(1));
});
