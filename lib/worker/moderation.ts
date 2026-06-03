import { addJobLog, listDueRobloxModerationJobs, recordRobloxModerationAudit } from "@/lib/jobs/repository";
import type { JobView } from "@/lib/jobs/types";
import { auditRobloxAssetModeration } from "@/lib/roblox/upload";

export type ModerationPollingSummary = {
  checked: number;
  final: number;
  failed: number;
  skipped: number;
  maxAttemptsReached: number;
};

export function getModerationPollingConfig() {
  return {
    intervalMs: Math.max(5000, Number(process.env.PKAUDIO_MODERATION_POLL_INTERVAL_MS ?? 15000)),
    maxAttempts: Math.max(1, Number(process.env.PKAUDIO_MODERATION_POLL_MAX_ATTEMPTS ?? 40)),
    maxPerTick: Math.max(1, Math.min(25, Number(process.env.PKAUDIO_MODERATION_POLL_MAX_PER_TICK ?? 8))),
  };
}

async function checkOneJob(job: JobView, maxAttempts: number) {
  if (!job.credentialId || !job.assetId) return { checked: false, final: false, failed: false, maxAttemptsReached: false };

  try {
    const attempt = job.robloxModerationAttemptCount + 1;
    const audit = await auditRobloxAssetModeration({ credentialId: job.credentialId, assetId: job.assetId });
    await recordRobloxModerationAudit(job.id, { ...audit, attemptCount: attempt });

    if (audit.state === "approved" || audit.state === "rejected") {
      await addJobLog(job.id, `Roblox moderation reached final state: ${audit.state}.`);
      return { checked: true, final: true, failed: false, maxAttemptsReached: false };
    }

    if (attempt >= maxAttempts) {
      await addJobLog(job.id, "Roblox moderation polling reached max attempts; leaving latest status for manual re-check.", "warn");
      return { checked: true, final: false, failed: false, maxAttemptsReached: true };
    }

    await addJobLog(job.id, `Roblox moderation still ${audit.state}; background worker will check again (${attempt}/${maxAttempts}).`);
    return { checked: true, final: false, failed: false, maxAttemptsReached: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roblox moderation polling failed.";
    await recordRobloxModerationAudit(job.id, { state: "failed", errorMessage: message });
    await addJobLog(job.id, `Roblox moderation polling failed but upload remains completed: ${message}`, "warn");
    return { checked: true, final: false, failed: true, maxAttemptsReached: false };
  }
}

export async function pollDueRobloxModerationJobs(): Promise<ModerationPollingSummary> {
  const config = getModerationPollingConfig();
  const dueJobs = await listDueRobloxModerationJobs({
    intervalMs: config.intervalMs,
    maxAttempts: config.maxAttempts,
    limit: config.maxPerTick,
  });

  const summary: ModerationPollingSummary = { checked: 0, final: 0, failed: 0, skipped: 0, maxAttemptsReached: 0 };
  for (const job of dueJobs) {
    const result = await checkOneJob(job, config.maxAttempts);
    if (!result.checked) {
      summary.skipped += 1;
      continue;
    }
    summary.checked += 1;
    if (result.final) summary.final += 1;
    if (result.failed) summary.failed += 1;
    if (result.maxAttemptsReached) summary.maxAttemptsReached += 1;
  }

  return summary;
}
