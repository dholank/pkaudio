#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import type { JobStatus } from "@/lib/jobs/types";

const dbRelativePath = "./tmp/smoke-converted-upload.sqlite";
const dbPath = path.join(process.cwd(), dbRelativePath);
process.env.PKAUDIO_DB_PATH = dbRelativePath;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function removeSmokeDb() {
  await Promise.all([
    fs.rm(dbPath, { force: true }),
    fs.rm(`${dbPath}-wal`, { force: true }),
    fs.rm(`${dbPath}-shm`, { force: true }),
  ]);
}

async function main() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await removeSmokeDb();

  const [{ closeDatabaseConnection, getDb }, { batches, credentials, jobs }, repository, health] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
    import("@/lib/jobs/repository"),
    import("@/lib/worker/health"),
  ]);

  const db = getDb();
  const now = Date.now();
  const batchId = "smoke-batch-converted-upload";

  db.insert(credentials)
    .values({
      id: "smoke-credential",
      name: "Smoke Credential",
      creatorType: "group",
      creatorId: "123456",
      keyPreview: "rbx_••••smoke",
      encryptedApiKey: "smoke-encrypted-placeholder",
      status: "active",
      lastUsedAt: null,
      testedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(batches)
    .values({
      id: batchId,
      name: "Smoke converted upload gate",
      status: "active",
      urlCount: 4,
      speed: 1.25,
      amplifyDb: 2,
      quality: "q7",
      audioSafetyMode: "roblox_safe",
      headroomDb: -3,
      limiterEnabled: true,
      uploadEnabled: true,
      credentialId: "smoke-credential",
      credentialName: "Smoke Credential",
      assetNamePattern: "{title} - PKAudio",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const baseJob = {
    batchId,
    sourcePlatform: "unknown" as const,
    speed: 1.25,
    amplifyDb: 2,
    quality: "q7" as const,
    audioSafetyMode: "roblox_safe" as const,
    headroomDb: -3,
    limiterEnabled: true,
    uploadEnabled: true,
    credentialId: "smoke-credential",
    credentialName: "Smoke Credential",
    assetNamePattern: "{title} - PKAudio",
    outputDurationSec: 12,
    outputSizeBytes: 256_000,
    outputPeakDb: -3.1,
    outputMeanDb: -16,
    outputSampleRate: 44100,
    outputChannels: 2,
    attemptCount: 1,
    maxAttempts: 2,
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
  };

  function job(id: string, status: JobStatus, offset: number, outputPath: string | null) {
    return {
      ...baseJob,
      id,
      sourceUrl: `file:///tmp/${id}.wav`,
      title: id,
      status,
      progress: status === "converted" ? 85 : status === "converting" ? 68 : 100,
      outputPath,
      createdAt: now + offset,
      updatedAt: now + offset,
    };
  }

  db.insert(jobs)
    .values([
      job("smoke-converted-a", "converted", 1, "outputs/smoke-a.ogg"),
      job("smoke-converting", "converting", 2, null),
      job("smoke-converted-b", "converted", 3, "outputs/smoke-b.ogg"),
      job("smoke-failed-upload", "failed", 4, "outputs/smoke-failed.ogg"),
    ])
    .run();

  const blocked = await repository.claimNextConvertedUploadJob();
  assert(blocked === null, "converted upload claim should wait until the whole batch is past conversion statuses");

  await repository.updateJobProgress("smoke-converting", {
    status: "done",
    progress: 100,
    outputPath: "outputs/smoke-converting.ogg",
  });

  const firstClaim = await repository.claimNextConvertedUploadJob();
  assert(firstClaim?.id === "smoke-converted-a", "first converted job should be claimed by createdAt order");
  assert(firstClaim.status === "uploading", "claimed converted job should move to uploading");

  const blockedByActiveUpload = await repository.claimNextConvertedUploadJob();
  assert(blockedByActiveUpload === null, "serial upload lane should not claim a second job while one is uploading");

  await repository.updateJobProgress("smoke-converted-a", {
    status: "done",
    progress: 100,
    assetId: "1234567890",
    robloxModerationState: "reviewing",
  });

  const secondClaim = await repository.claimNextConvertedUploadJob();
  assert(secondClaim?.id === "smoke-converted-b", "second converted job should claim after active upload finishes");
  await repository.updateJobProgress("smoke-converted-b", { status: "done", progress: 100, assetId: "9876543210" });

  const retried = await repository.retryJob("smoke-failed-upload");
  assert(retried?.status === "converted", "failed upload retry should reuse existing converted OGG");
  assert(retried.outputPath === "outputs/smoke-failed.ogg", "failed upload retry should keep outputPath");

  const stats = await health.getQueueDepthStats();
  assert(stats.converted === 1, `queue depth should expose one converted/upload-ready job, got ${stats.converted}`);
  assert(stats.active === 0, `smoke DB should have no active jobs at the end, got ${stats.active}`);

  closeDatabaseConnection();
  await removeSmokeDb();
  console.log("[smoke] converted upload gate, serial claim, retry reuse, and queue depth passed.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  const { closeDatabaseConnection } = await import("@/lib/db/client");
  closeDatabaseConnection();
  process.exit(1);
});
