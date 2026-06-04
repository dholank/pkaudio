import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { batches, jobLogs, jobs, type BatchRow, type JobLogRow, type JobRow, type NewJobLogRow } from "@/lib/db/schema";
import { getCredentialById } from "@/lib/credentials/repository";
import { deleteJobArtifacts, type JobArtifactCleanupResult } from "@/lib/storage/local";
import type { BatchStatus, BatchView, JobLogView, JobStatus, JobView, RobloxModerationState, SourcePlatform } from "@/lib/jobs/types";
import type { CreateBatchInput, ListJobsQueryInput } from "@/lib/jobs/validation";
import { formatTrimPartTitle } from "@/lib/trim/auto-cut";

function iso(timestamp: number) {
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

const ACTIVE_JOB_STATUSES = ["downloading", "probing", "converting", "uploading"] as const satisfies readonly JobStatus[];
const DELETABLE_JOB_STATUSES = ["queued", "converted", "done", "failed", "cancelled"] as const satisfies readonly JobStatus[];

export type StaleJobRecoverySummary = {
  checked: number;
  requeued: number;
  failed: number;
  cutoff: string;
  maxAgeMs: number;
};

export type DeleteJobResult = {
  id: string;
  batchId: string;
  batchDeleted: boolean;
  cleanup: JobArtifactCleanupResult | null;
};

function cleanUrls(urls: string[]) {
  const seen = new Set<string>();
  return urls
    .map((url) => url.trim())
    .filter(Boolean)
    .filter((url) => {
      const key = url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function createBatch(input: CreateBatchInput) {
  const urls = cleanUrls(input.urls);
  if (!urls.length) throw new Error("At least one valid URL is required.");

  let credentialName: string | null = null;
  let credentialId: string | null = null;

  if (input.uploadEnabled) {
    if (!input.credentialId) throw new Error("Credential is required when auto upload is enabled.");
    const credential = await getCredentialById(input.credentialId);
    if (!credential) throw new Error("Selected credential was not found.");
    credentialId = credential.id;
    credentialName = credential.name;
  }

  const now = Date.now();
  const batchId = randomUUID();
  const batchName = `Batch ${new Date(now).toLocaleString("en-US", { hour12: false })}`;

  const db = getDb();
  const transactionResult = db.transaction(() => {
    const batchRow = {
      id: batchId,
      name: batchName,
      status: "queued" as const,
      urlCount: urls.length,
      speed: input.speed,
      amplifyDb: input.amplifyDb,
      targetLufs: input.targetLufs,
      quality: input.quality,
      audioSafetyMode: input.audioSafetyMode,
      headroomDb: input.headroomDb,
      limiterEnabled: input.limiterEnabled,
      uploadEnabled: input.uploadEnabled,
      credentialId,
      credentialName,
      assetNamePattern: input.assetNamePattern,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(batches).values(batchRow).run();

    const jobRows = urls.map((url) => ({
      id: randomUUID(),
      batchId,
      sourceUrl: url,
      sourcePlatform: detectSourcePlatform(url),
      title: null,
      status: "queued" as const,
      progress: 0,
      speed: input.speed,
      amplifyDb: input.amplifyDb,
      targetLufs: input.targetLufs,
      quality: input.quality,
      audioSafetyMode: input.audioSafetyMode,
      headroomDb: input.headroomDb,
      limiterEnabled: input.limiterEnabled,
      uploadEnabled: input.uploadEnabled,
      credentialId,
      credentialName,
      assetNamePattern: input.assetNamePattern,
      sourceLocalPath: null,
      trimGroupId: null,
      trimOriginalUrl: null,
      trimPartIndex: null,
      trimPartTotal: null,
      trimStartSec: null,
      trimDurationSec: null,
      outputPath: null,
      outputDurationSec: null,
      outputSizeBytes: null,
      outputPeakDb: null,
      outputMeanDb: null,
      outputSampleRate: null,
      outputChannels: null,
      attemptCount: 0,
      maxAttempts: 1,
      assetId: null,
      robloxOperationId: null,
      robloxOperationPath: null,
      robloxOperationStatus: "none" as const,
      robloxOperationCheckedAt: null,
      robloxOperationRaw: null,
      robloxModerationState: "none" as const,
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
    }));

    db.insert(jobs).values(jobRows).run();

    const logRows: NewJobLogRow[] = jobRows.map((job) => ({
      id: randomUUID(),
      jobId: job.id,
      level: "info" as const,
      message: "Job queued. Local media worker will pick it up when running.",
      createdAt: now,
    }));

    db.insert(jobLogs).values(logRows).run();

    return {
      batch: toBatchView(batchRow),
      jobs: jobRows.map(toJobView),
    };
  });

  return transactionResult;
}

export type CreateTrimBatchInput = Omit<CreateBatchInput, "urls"> & {
  sourceUrl: string;
  sourceTitle?: string | null;
  parts: Array<{
    index: number;
    total: number;
    startSec: number;
    durationSec: number;
    sourceLocalPath: string;
    title?: string | null;
  }>;
};

export async function createTrimBatch(input: CreateTrimBatchInput) {
  const parts = [...input.parts].sort((a, b) => a.index - b.index);
  if (!parts.length) throw new Error("At least one trim part is required.");

  let credentialName: string | null = null;
  let credentialId: string | null = null;

  if (input.uploadEnabled) {
    if (!input.credentialId) throw new Error("Credential is required when auto upload is enabled.");
    const credential = await getCredentialById(input.credentialId);
    if (!credential) throw new Error("Selected credential was not found.");
    credentialId = credential.id;
    credentialName = credential.name;
  }

  const now = Date.now();
  const batchId = randomUUID();
  const trimGroupId = randomUUID();
  const batchName = `Trim Batch ${new Date(now).toLocaleString("en-US", { hour12: false })}`;

  const db = getDb();
  return db.transaction(() => {
    const batchRow = {
      id: batchId,
      name: batchName,
      status: "queued" as const,
      urlCount: parts.length,
      speed: input.speed,
      amplifyDb: input.amplifyDb,
      targetLufs: input.targetLufs,
      quality: input.quality,
      audioSafetyMode: input.audioSafetyMode,
      headroomDb: input.headroomDb,
      limiterEnabled: input.limiterEnabled,
      uploadEnabled: input.uploadEnabled,
      credentialId,
      credentialName,
      assetNamePattern: input.assetNamePattern,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(batches).values(batchRow).run();

    const jobRows = parts.map((part) => ({
      id: randomUUID(),
      batchId,
      sourceUrl: input.sourceUrl,
      sourcePlatform: detectSourcePlatform(input.sourceUrl),
      title: part.title ?? formatTrimPartTitle(input.sourceTitle, part),
      status: "queued" as const,
      progress: 0,
      speed: input.speed,
      amplifyDb: input.amplifyDb,
      targetLufs: input.targetLufs,
      quality: input.quality,
      audioSafetyMode: input.audioSafetyMode,
      headroomDb: input.headroomDb,
      limiterEnabled: input.limiterEnabled,
      uploadEnabled: input.uploadEnabled,
      credentialId,
      credentialName,
      assetNamePattern: input.assetNamePattern,
      sourceLocalPath: part.sourceLocalPath,
      trimGroupId,
      trimOriginalUrl: input.sourceUrl,
      trimPartIndex: part.index,
      trimPartTotal: part.total,
      trimStartSec: part.startSec,
      trimDurationSec: part.durationSec,
      outputPath: null,
      outputDurationSec: null,
      outputSizeBytes: null,
      outputPeakDb: null,
      outputMeanDb: null,
      outputSampleRate: null,
      outputChannels: null,
      attemptCount: 0,
      maxAttempts: 1,
      assetId: null,
      robloxOperationId: null,
      robloxOperationPath: null,
      robloxOperationStatus: "none" as const,
      robloxOperationCheckedAt: null,
      robloxOperationRaw: null,
      robloxModerationState: "none" as const,
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error: null,
      createdAt: now + part.index,
      updatedAt: now,
    }));

    db.insert(jobs).values(jobRows).run();

    const logRows: NewJobLogRow[] = jobRows.map((job) => ({
      id: randomUUID(),
      jobId: job.id,
      level: "info",
      message: `Trim part ${job.trimPartIndex}/${job.trimPartTotal} queued from ${job.trimStartSec}s for ${job.trimDurationSec}s. Local media worker will convert this part when running.`,
      createdAt: now,
    }));

    db.insert(jobLogs).values(logRows).run();

    return {
      batch: toBatchView(batchRow),
      jobs: jobRows.map(toJobView),
    };
  });
}

export async function listBatches(limit = 50) {
  return getDb()
    .select()
    .from(batches)
    .orderBy(desc(batches.createdAt))
    .limit(limit)
    .all()
    .map(toBatchView);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function orderForJobs(sort: ListJobsQueryInput["sort"] = "newest") {
  switch (sort) {
    case "oldest":
      return asc(jobs.createdAt);
    case "title":
      return asc(jobs.title);
    case "duration":
      return desc(jobs.outputDurationSec);
    case "size":
      return desc(jobs.outputSizeBytes);
    case "peak":
      return desc(jobs.outputPeakDb);
    case "newest":
    default:
      return desc(jobs.createdAt);
  }
}

export async function listJobs(options: ListJobsQueryInput = {}) {
  const filters = [];
  if (options.status && options.status !== "all") filters.push(eq(jobs.status, options.status as JobStatus));
  if (options.batchId) filters.push(eq(jobs.batchId, options.batchId));
  if (options.platform && options.platform !== "all") filters.push(eq(jobs.sourcePlatform, options.platform));
  if (options.credentialId && options.credentialId !== "all") filters.push(eq(jobs.credentialId, options.credentialId));
  if (options.upload === "uploaded") filters.push(sql`${jobs.assetId} is not null`);
  if (options.upload === "pending") filters.push(and(eq(jobs.uploadEnabled, true), sql`${jobs.assetId} is null`));
  if (options.upload === "local") filters.push(eq(jobs.uploadEnabled, false));
  if (options.moderation && options.moderation !== "all") filters.push(eq(jobs.robloxModerationState, options.moderation));
  if (options.dateRange === "today") filters.push(gte(jobs.createdAt, startOfToday()));
  if (options.dateRange === "week") filters.push(gte(jobs.createdAt, Date.now() - 7 * 24 * 60 * 60 * 1000));
  if (options.q) {
    const pattern = `%${options.q.trim()}%`;
    filters.push(
      or(
        like(jobs.id, pattern),
        like(jobs.batchId, pattern),
        like(jobs.sourceUrl, pattern),
        like(jobs.title, pattern),
        like(jobs.assetId, pattern),
        like(jobs.credentialName, pattern),
        like(jobs.outputPath, pattern),
        like(jobs.robloxOperationId, pattern),
        like(jobs.robloxOperationStatus, pattern),
        like(jobs.robloxModerationState, pattern),
        like(jobs.error, pattern),
      ),
    );
  }

  const rows = getDb()
    .select()
    .from(jobs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(orderForJobs(options.sort))
    .limit(options.limit ?? 100)
    .all();

  return rows.map(toJobView);
}

export async function getLatestBatch() {
  const row = getDb().select().from(batches).orderBy(desc(batches.createdAt)).limit(1).get();
  return row ? toBatchView(row) : null;
}

function sortTrimPartsFirstByIndex(jobList: JobView[]) {
  if (!jobList.some((job) => job.trimPartIndex !== null)) return jobList;
  return [...jobList].sort((a, b) => {
    if (a.trimPartIndex !== null && b.trimPartIndex !== null) return a.trimPartIndex - b.trimPartIndex;
    if (a.trimPartIndex !== null) return -1;
    if (b.trimPartIndex !== null) return 1;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}

export async function listLatestBatchJobs(options: ListJobsQueryInput = {}) {
  const latestBatch = await getLatestBatch();
  if (!latestBatch) return { batch: null, jobs: [] as JobView[] };
  const latestJobs = await listJobs({ ...options, batchId: latestBatch.id });
  return { batch: latestBatch, jobs: options.sort ? latestJobs : sortTrimPartsFirstByIndex(latestJobs) };
}

export async function getJobById(id: string) {
  return getDb().select().from(jobs).where(eq(jobs.id, id)).get() ?? null;
}

export async function listJobLogs(jobId: string) {
  return getDb()
    .select()
    .from(jobLogs)
    .where(eq(jobLogs.jobId, jobId))
    .orderBy(jobLogs.createdAt)
    .all()
    .map(toJobLogView);
}

export async function addJobLog(jobId: string, message: string, level: "info" | "warn" | "error" = "info") {
  const row = {
    id: randomUUID(),
    jobId,
    level,
    message,
    createdAt: Date.now(),
  };

  getDb().insert(jobLogs).values(row).run();
  return toJobLogView(row);
}

export async function refreshBatchStatus(batchId: string) {
  const batchJobs = getDb().select().from(jobs).where(eq(jobs.batchId, batchId)).all();
  if (!batchJobs.length) return null;

  const statuses = batchJobs.map((job) => job.status);
  let status: BatchStatus = "active";

  if (statuses.every((item) => item === "done")) status = "done";
  else if (statuses.every((item) => item === "cancelled")) status = "cancelled";
  else if (statuses.some((item) => item === "failed") && statuses.every((item) => ["done", "failed", "cancelled"].includes(item))) status = "failed";
  else if (statuses.every((item) => item === "queued")) status = "queued";

  getDb().update(batches).set({ status, updatedAt: Date.now() }).where(eq(batches.id, batchId)).run();
  return status;
}

export async function claimNextQueuedJob(options: { maxAttempts?: number } = {}) {
  const db = getDb();
  const configuredMaxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
  return db.transaction(() => {
    const row = db.select().from(jobs).where(eq(jobs.status, "queued")).orderBy(asc(jobs.createdAt)).get();
    if (!row) return null;

    const now = Date.now();
    const nextAttemptCount = row.attemptCount + 1;
    const maxAttempts = Math.max(row.maxAttempts, configuredMaxAttempts);
    const result = db
      .update(jobs)
      .set({ status: "downloading", progress: 5, error: null, attemptCount: nextAttemptCount, maxAttempts, updatedAt: now })
      .where(and(eq(jobs.id, row.id), eq(jobs.status, "queued")))
      .run();

    if (result.changes === 0) return null;

    db.update(batches).set({ status: "active", updatedAt: now }).where(eq(batches.id, row.batchId)).run();
    db.insert(jobLogs)
      .values({
        id: randomUUID(),
        jobId: row.id,
        level: "info",
        message: `Worker claimed job. Attempt ${nextAttemptCount}/${maxAttempts}.`,
        createdAt: now,
      })
      .run();

    return toJobView({ ...row, status: "downloading", progress: 5, error: null, attemptCount: nextAttemptCount, maxAttempts, updatedAt: now });
  });
}

export async function claimNextQueuedJobs(count: number, options: { maxAttempts?: number } = {}) {
  const claimed: JobView[] = [];
  const safeCount = Math.max(1, Math.min(8, Math.floor(count)));
  for (let index = 0; index < safeCount; index += 1) {
    const job = await claimNextQueuedJob(options);
    if (!job) break;
    claimed.push(job);
  }
  return claimed;
}

export async function claimNextConvertedUploadJob() {
  const db = getDb();
  return db.transaction(() => {
    const activeUpload = db.select({ id: jobs.id }).from(jobs).where(eq(jobs.status, "uploading")).get();
    if (activeUpload) return null;

    const row = db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "converted"),
          eq(jobs.uploadEnabled, true),
          sql`${jobs.outputPath} is not null`,
          sql`${jobs.assetId} is null`,
          sql`not exists (
            select 1
            from jobs pending
            where pending.batch_id = ${jobs.batchId}
              and pending.status in ('queued', 'downloading', 'probing', 'converting')
          )`,
        ),
      )
      .orderBy(asc(jobs.createdAt))
      .get();

    if (!row) return null;

    const now = Date.now();
    const result = db
      .update(jobs)
      .set({ status: "uploading", progress: 90, error: null, updatedAt: now })
      .where(
        and(
          eq(jobs.id, row.id),
          eq(jobs.status, "converted"),
          sql`not exists (select 1 from jobs active_upload where active_upload.status = 'uploading')`,
        ),
      )
      .run();

    if (result.changes === 0) return null;

    db.update(batches).set({ status: "active", updatedAt: now }).where(eq(batches.id, row.batchId)).run();
    db.insert(jobLogs)
      .values({
        id: randomUUID(),
        jobId: row.id,
        level: "info",
        message: "Upload worker claimed converted job after the batch conversion gate cleared.",
        createdAt: now,
      })
      .run();

    return toJobView({ ...row, status: "uploading", progress: 90, error: null, updatedAt: now });
  });
}

type JobProgressPatch = {
  status?: JobStatus;
  progress?: number;
  title?: string | null;
  outputPath?: string | null;
  outputDurationSec?: number | null;
  outputSizeBytes?: number | null;
  outputPeakDb?: number | null;
  outputMeanDb?: number | null;
  outputSampleRate?: number | null;
  outputChannels?: number | null;
  assetId?: string | null;
  robloxOperationId?: string | null;
  robloxOperationPath?: string | null;
  robloxOperationStatus?: "none" | "pending" | "done" | "failed" | "unknown";
  robloxOperationCheckedAt?: number | null;
  robloxOperationRaw?: string | null;
  robloxModerationState?: RobloxModerationState;
  robloxModerationCheckedAt?: number | null;
  robloxModerationRaw?: string | null;
  robloxModerationAttemptCount?: number;
  error?: string | null;
};

function pickNullablePatch<T extends keyof JobProgressPatch>(patch: JobProgressPatch, key: T, fallback: JobRow[T]) {
  return key in patch && patch[key] !== undefined ? patch[key] : fallback;
}

export async function updateJobProgress(id: string, patch: JobProgressPatch) {
  const existing = await getJobById(id);
  if (!existing) return null;

  const updatedAt = Date.now();
  getDb()
    .update(jobs)
    .set({
      status: patch.status ?? existing.status,
      progress: patch.progress ?? existing.progress,
      title: pickNullablePatch(patch, "title", existing.title),
      outputPath: pickNullablePatch(patch, "outputPath", existing.outputPath),
      outputDurationSec: pickNullablePatch(patch, "outputDurationSec", existing.outputDurationSec),
      outputSizeBytes: pickNullablePatch(patch, "outputSizeBytes", existing.outputSizeBytes),
      outputPeakDb: pickNullablePatch(patch, "outputPeakDb", existing.outputPeakDb),
      outputMeanDb: pickNullablePatch(patch, "outputMeanDb", existing.outputMeanDb),
      outputSampleRate: pickNullablePatch(patch, "outputSampleRate", existing.outputSampleRate),
      outputChannels: pickNullablePatch(patch, "outputChannels", existing.outputChannels),
      assetId: pickNullablePatch(patch, "assetId", existing.assetId),
      robloxOperationId: pickNullablePatch(patch, "robloxOperationId", existing.robloxOperationId),
      robloxOperationPath: pickNullablePatch(patch, "robloxOperationPath", existing.robloxOperationPath),
      robloxOperationStatus: patch.robloxOperationStatus ?? existing.robloxOperationStatus,
      robloxOperationCheckedAt: pickNullablePatch(patch, "robloxOperationCheckedAt", existing.robloxOperationCheckedAt),
      robloxOperationRaw: pickNullablePatch(patch, "robloxOperationRaw", existing.robloxOperationRaw),
      robloxModerationState: patch.robloxModerationState ?? existing.robloxModerationState,
      robloxModerationCheckedAt: pickNullablePatch(patch, "robloxModerationCheckedAt", existing.robloxModerationCheckedAt),
      robloxModerationRaw: pickNullablePatch(patch, "robloxModerationRaw", existing.robloxModerationRaw),
      robloxModerationAttemptCount: patch.robloxModerationAttemptCount ?? existing.robloxModerationAttemptCount,
      error: pickNullablePatch(patch, "error", existing.error),
      updatedAt,
    })
    .where(eq(jobs.id, id))
    .run();

  const updated = await getJobById(id);
  if (updated) await refreshBatchStatus(updated.batchId);
  return updated ? toJobView(updated) : null;
}

export type AudioDiagnosticsPatch = Pick<
  JobProgressPatch,
  "outputDurationSec" | "outputSizeBytes" | "outputPeakDb" | "outputMeanDb" | "outputSampleRate" | "outputChannels"
>;

export async function completeJob(id: string, outputPath: string, title?: string | null, diagnostics: AudioDiagnosticsPatch = {}) {
  const updated = await updateJobProgress(id, { status: "done", progress: 100, outputPath, title: title ?? undefined, error: null, ...diagnostics });
  if (updated) await addJobLog(id, "Conversion completed.");
  return updated;
}

export async function markJobConverted(id: string, outputPath: string, title?: string | null, diagnostics: AudioDiagnosticsPatch = {}) {
  const updated = await updateJobProgress(id, { status: "converted", progress: 85, outputPath, title: title ?? undefined, error: null, ...diagnostics });
  if (updated) await addJobLog(id, "Conversion completed. Job is waiting for the serial Roblox upload worker.");
  return updated;
}

export async function failJob(id: string, error: string) {
  const updated = await updateJobProgress(id, { status: "failed", error });
  if (updated) await addJobLog(id, error, "error");
  return updated;
}

export async function requeueJobAfterTransientFailure(id: string, error: string) {
  const existing = await getJobById(id);
  if (!existing) return null;

  const now = Date.now();
  getDb()
    .update(jobs)
    .set({
      status: "queued",
      progress: 0,
      outputPath: null,
      outputDurationSec: null,
      outputSizeBytes: null,
      outputPeakDb: null,
      outputMeanDb: null,
      outputSampleRate: null,
      outputChannels: null,
      assetId: null,
      robloxOperationId: null,
      robloxOperationPath: null,
      robloxOperationStatus: "none",
      robloxOperationCheckedAt: null,
      robloxOperationRaw: null,
      robloxModerationState: "none",
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error,
      updatedAt: now,
    })
    .where(eq(jobs.id, id))
    .run();

  await addJobLog(id, `Transient failure; auto retry scheduled (${existing.attemptCount}/${existing.maxAttempts} attempts used): ${error}`, "warn");
  const updated = await getJobById(id);
  if (updated) await refreshBatchStatus(updated.batchId);
  return updated ? toJobView(updated) : null;
}

export async function updateJobStatus(id: string, status: JobStatus, options: { error?: string | null; progress?: number } = {}) {
  const existing = await getJobById(id);
  if (!existing) return null;

  const progress = options.progress ?? existing.progress;
  const error = "error" in options ? options.error : existing.error;
  const now = Date.now();
  getDb()
    .update(jobs)
    .set({ status, progress, error, updatedAt: now })
    .where(eq(jobs.id, id))
    .run();

  const logMessage = status === "cancelled" ? "Job cancelled by user." : `Job status changed to ${status}.`;
  await addJobLog(id, logMessage, status === "failed" ? "error" : "info");

  const updated = await getJobById(id);
  if (updated) await refreshBatchStatus(updated.batchId);
  return updated ? toJobView(updated) : null;
}

export async function recordRobloxModerationAudit(
  id: string,
  audit: {
    state: RobloxModerationState;
    raw?: unknown;
    attemptCount?: number;
    errorMessage?: string | null;
  },
) {
  const existing = await getJobById(id);
  const attemptCount = audit.attemptCount ?? ((existing?.robloxModerationAttemptCount ?? 0) + 1);
  const updated = await updateJobProgress(id, {
    robloxModerationState: audit.state,
    robloxModerationCheckedAt: Date.now(),
    robloxModerationRaw: JSON.stringify(audit.raw ?? null),
    robloxModerationAttemptCount: attemptCount,
    error: audit.state === "failed" ? audit.errorMessage ?? "Roblox moderation check failed." : undefined,
  });

  const details = audit.errorMessage ? ` ${audit.errorMessage}` : "";
  await addJobLog(id, `Roblox moderation check: ${audit.state}.${details}`, audit.state === "rejected" || audit.state === "failed" ? "warn" : "info");
  return updated;
}

export async function recordRobloxOperationAudit(
  id: string,
  audit: {
    assetId?: string | null;
    operationId?: string | null;
    operationPath?: string | null;
    status: "pending" | "done" | "failed" | "unknown";
    rawOperation?: unknown;
    errorMessage?: string | null;
  },
) {
  const updated = await updateJobProgress(id, {
    assetId: audit.assetId ?? undefined,
    robloxOperationId: audit.operationId ?? undefined,
    robloxOperationPath: audit.operationPath ?? undefined,
    robloxOperationStatus: audit.status,
    robloxOperationCheckedAt: Date.now(),
    robloxOperationRaw: JSON.stringify(audit.rawOperation ?? null),
    error: audit.status === "failed" || audit.status === "unknown" ? audit.errorMessage ?? "Roblox operation audit reported an issue." : undefined,
  });

  const details = audit.assetId ? ` Asset ID: ${audit.assetId}.` : audit.errorMessage ? ` ${audit.errorMessage}` : "";
  await addJobLog(id, `Roblox operation audit: ${audit.status}.${details}`, audit.status === "failed" ? "warn" : "info");
  return updated;
}

export async function listDueRobloxModerationJobs(options: { limit?: number; intervalMs?: number } = {}) {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 8)));
  const intervalMs = Math.max(5000, Math.floor(options.intervalMs ?? 15000));
  const cutoff = Date.now() - intervalMs;

  const rows = getDb()
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "done"),
        sql`${jobs.assetId} is not null`,
        sql`${jobs.credentialId} is not null`,
        inArray(jobs.robloxModerationState, ["none", "reviewing", "unknown", "failed"]),
        or(sql`${jobs.robloxModerationCheckedAt} is null`, lt(jobs.robloxModerationCheckedAt, cutoff)),
      ),
    )
    .orderBy(asc(jobs.robloxModerationCheckedAt), asc(jobs.createdAt))
    .limit(limit)
    .all();

  return rows.map(toJobView);
}

export async function retryJob(id: string) {
  const existing = await getJobById(id);
  if (!existing) return null;

  const now = Date.now();
  const canRetryUploadOnly = existing.uploadEnabled && Boolean(existing.outputPath) && !existing.assetId;

  if (canRetryUploadOnly) {
    getDb()
      .update(jobs)
      .set({
        status: "converted",
        progress: 85,
        robloxOperationId: null,
        robloxOperationPath: null,
        robloxOperationStatus: "none",
        robloxOperationCheckedAt: null,
        robloxOperationRaw: null,
        robloxModerationState: "none",
        robloxModerationCheckedAt: null,
        robloxModerationRaw: null,
        robloxModerationAttemptCount: 0,
        error: null,
        updatedAt: now,
      })
      .where(eq(jobs.id, id))
      .run();

    await addJobLog(id, "Upload retry queued from existing converted OGG; conversion output was kept.");
    const updated = await getJobById(id);
    if (updated) await refreshBatchStatus(updated.batchId);
    return updated ? toJobView(updated) : null;
  }

  getDb()
    .update(jobs)
    .set({
      status: "queued",
      progress: 0,
      outputPath: null,
      outputDurationSec: null,
      outputSizeBytes: null,
      outputPeakDb: null,
      outputMeanDb: null,
      outputSampleRate: null,
      outputChannels: null,
      attemptCount: 0,
      maxAttempts: 1,
      assetId: null,
      robloxOperationId: null,
      robloxOperationPath: null,
      robloxOperationStatus: "none",
      robloxOperationCheckedAt: null,
      robloxOperationRaw: null,
      robloxModerationState: "none",
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error: null,
      updatedAt: now,
    })
    .where(eq(jobs.id, id))
    .run();

  await addJobLog(id, "Job re-queued by user.");
  const updated = await getJobById(id);
  if (updated) await refreshBatchStatus(updated.batchId);
  return updated ? toJobView(updated) : null;
}


export async function recoverStaleJobs(options: { maxAgeMs?: number; failUploading?: boolean } = {}): Promise<StaleJobRecoverySummary> {
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000;
  const failUploading = options.failUploading ?? true;
  const now = Date.now();
  const cutoff = now - maxAgeMs;
  const db = getDb();

  const staleRows = db
    .select()
    .from(jobs)
    .where(and(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]), lt(jobs.updatedAt, cutoff)))
    .orderBy(asc(jobs.updatedAt))
    .all();

  if (!staleRows.length) {
    return { checked: 0, requeued: 0, failed: 0, cutoff: iso(cutoff), maxAgeMs };
  }

  const touchedBatchIds = new Set<string>();
  let requeued = 0;
  let failed = 0;

  db.transaction(() => {
    for (const row of staleRows) {
      touchedBatchIds.add(row.batchId);
      const ageMinutes = Math.max(1, Math.round((now - row.updatedAt) / 60000));

      if (row.status === "uploading" && failUploading) {
        const message = `Recovered stale uploading job after ${ageMinutes} minute(s). Marked failed to avoid accidental duplicate Roblox upload; retry manually if needed.`;
        const result = db
          .update(jobs)
          .set({ status: "failed", error: message, updatedAt: now })
          .where(and(eq(jobs.id, row.id), eq(jobs.status, row.status)))
          .run();

        if (result.changes > 0) {
          failed += 1;
          db.insert(jobLogs)
            .values({ id: randomUUID(), jobId: row.id, level: "warn", message, createdAt: now })
            .run();
        }
        continue;
      }

      const message = `Recovered stale ${row.status} job after ${ageMinutes} minute(s). Re-queued for worker retry.`;
      const result = db
        .update(jobs)
        .set({
          status: "queued",
          progress: 0,
          outputPath: null,
          outputDurationSec: null,
          outputSizeBytes: null,
          outputPeakDb: null,
          outputMeanDb: null,
          outputSampleRate: null,
          outputChannels: null,
          assetId: null,
          error: null,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, row.id), eq(jobs.status, row.status)))
        .run();

      if (result.changes > 0) {
        requeued += 1;
        db.insert(jobLogs)
          .values({ id: randomUUID(), jobId: row.id, level: "warn", message, createdAt: now })
          .run();
      }
    }
  });

  for (const batchId of touchedBatchIds) {
    await refreshBatchStatus(batchId);
  }

  return { checked: staleRows.length, requeued, failed, cutoff: iso(cutoff), maxAgeMs };
}

export async function deleteJob(id: string, options: { deleteArtifacts?: boolean } = {}): Promise<DeleteJobResult | null> {
  const deleteArtifacts = options.deleteArtifacts ?? true;
  const db = getDb();
  const now = Date.now();

  const deleted = db.transaction(() => {
    const existing = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!existing) return null;

    if (!(DELETABLE_JOB_STATUSES as readonly JobStatus[]).includes(existing.status)) {
      throw new Error("Cancel or wait for this active job before deleting it.");
    }

    const result = db
      .delete(jobs)
      .where(and(eq(jobs.id, id), inArray(jobs.status, [...DELETABLE_JOB_STATUSES])))
      .run();

    if (result.changes === 0) {
      throw new Error("Job changed status before deletion. Refresh and try again.");
    }

    const remainingRow = db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.batchId, existing.batchId)).get();
    const remaining = Number(remainingRow?.count ?? 0);

    if (remaining === 0) {
      db.delete(batches).where(eq(batches.id, existing.batchId)).run();
    } else {
      db.update(batches).set({ urlCount: remaining, updatedAt: now }).where(eq(batches.id, existing.batchId)).run();
    }

    return { existing, remaining };
  });

  if (!deleted) return null;

  let cleanup: JobArtifactCleanupResult | null = null;
  if (deleteArtifacts) {
    cleanup = await deleteJobArtifacts(deleted.existing);
  }

  if (deleted.remaining > 0) {
    await refreshBatchStatus(deleted.existing.batchId);
  }

  return {
    id,
    batchId: deleted.existing.batchId,
    batchDeleted: deleted.remaining === 0,
    cleanup,
  };
}

export async function getJobStats() {
  const rows = getDb()
    .select({ status: jobs.status, count: sql<number>`count(*)` })
    .from(jobs)
    .groupBy(jobs.status)
    .all();

  const stats: Record<JobStatus, number> = {
    queued: 0,
    downloading: 0,
    probing: 0,
    converting: 0,
    converted: 0,
    uploading: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    stats[row.status] = Number(row.count);
  }

  return stats;
}
