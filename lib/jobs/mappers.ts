/**
 * Pure data mappers for jobs and batches — no DB queries, no side effects.
 */
import type { BatchRow, JobLogRow, JobRow } from "@/lib/db/schema";
import type { BatchView, JobLogView, JobView, SourcePlatform } from "@/lib/jobs/types";

export function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function detectSourcePlatform(url: string): SourcePlatform {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("soundcloud.com")) return "soundcloud";
  return "unknown";
}

export function toBatchView(row: BatchRow): BatchView {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    urlCount: row.urlCount,
    speed: row.speed,
    amplifyDb: row.amplifyDb,
    targetLufs: row.targetLufs,
    quality: row.quality,
    audioSafetyMode: row.audioSafetyMode,
    headroomDb: row.headroomDb,
    limiterEnabled: row.limiterEnabled,
    uploadEnabled: row.uploadEnabled,
    credentialId: row.credentialId,
    credentialName: row.credentialName,
    assetNamePattern: row.assetNamePattern,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toJobView(row: JobRow): JobView {
  return {
    id: row.id,
    batchId: row.batchId,
    sourceUrl: row.sourceUrl,
    sourcePlatform: row.sourcePlatform,
    title: row.title,
    status: row.status,
    progress: row.progress,
    speed: row.speed,
    amplifyDb: row.amplifyDb,
    targetLufs: row.targetLufs,
    quality: row.quality,
    audioSafetyMode: row.audioSafetyMode,
    headroomDb: row.headroomDb,
    limiterEnabled: row.limiterEnabled,
    uploadEnabled: row.uploadEnabled,
    credentialId: row.credentialId,
    credentialName: row.credentialName,
    assetNamePattern: row.assetNamePattern,
    sourceLocalPath: row.sourceLocalPath,
    trimGroupId: row.trimGroupId,
    trimOriginalUrl: row.trimOriginalUrl,
    trimPartIndex: row.trimPartIndex,
    trimPartTotal: row.trimPartTotal,
    trimStartSec: row.trimStartSec,
    trimDurationSec: row.trimDurationSec,
    outputPath: row.outputPath,
    outputDurationSec: row.outputDurationSec,
    outputSizeBytes: row.outputSizeBytes,
    outputPeakDb: row.outputPeakDb,
    outputMeanDb: row.outputMeanDb,
    outputSampleRate: row.outputSampleRate,
    outputChannels: row.outputChannels,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    assetId: row.assetId,
    robloxOperationId: row.robloxOperationId,
    robloxOperationPath: row.robloxOperationPath,
    robloxOperationStatus: row.robloxOperationStatus,
    robloxOperationCheckedAt: row.robloxOperationCheckedAt ? iso(row.robloxOperationCheckedAt) : null,
    robloxOperationRaw: row.robloxOperationRaw,
    robloxModerationState: row.robloxModerationState,
    robloxModerationCheckedAt: row.robloxModerationCheckedAt ? iso(row.robloxModerationCheckedAt) : null,
    robloxModerationRaw: row.robloxModerationRaw,
    robloxModerationAttemptCount: row.robloxModerationAttemptCount,
    error: row.error,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toJobLogView(row: JobLogRow): JobLogView {
  return {
    id: row.id,
    jobId: row.jobId,
    level: row.level,
    message: row.message,
    createdAt: iso(row.createdAt),
  };
}
