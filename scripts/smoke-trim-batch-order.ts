#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { inArray, like } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { batches, jobs } from "@/lib/db/schema";
import { createTrimBatch, listLatestBatchJobs } from "@/lib/jobs/repository";

const SMOKE_URL = "https://youtu.be/pkaudio-smoke-autocut-order";

function cleanupSmokeRows() {
  const db = getDb();
  const rows = db
    .select({ id: jobs.id, batchId: jobs.batchId })
    .from(jobs)
    .where(like(jobs.sourceUrl, "%pkaudio-smoke-autocut-order%"))
    .all();
  const batchIds = [...new Set(rows.map((row) => row.batchId))];
  if (rows.length) db.delete(jobs).where(inArray(jobs.id, rows.map((row) => row.id))).run();
  if (batchIds.length) db.delete(batches).where(inArray(batches.id, batchIds)).run();
}

async function main() {
  cleanupSmokeRows();

  try {
    const result = await createTrimBatch({
      sourceUrl: SMOKE_URL,
      sourceTitle: "Autocut Smoke Song",
      speed: 1,
      amplifyDb: -2,
      targetLufs: -14,
      quality: "q7",
      audioSafetyMode: "roblox_safe",
      headroomDb: -3,
      limiterEnabled: true,
      uploadEnabled: false,
      credentialId: null,
      assetNamePattern: "{title}",
      parts: [
        { index: 1, total: 3, startSec: 0, durationSec: 300, sourceLocalPath: "/tmp/pkaudio-smoke-autocut-order-001.wav" },
        { index: 2, total: 3, startSec: 300, durationSec: 300, sourceLocalPath: "/tmp/pkaudio-smoke-autocut-order-002.wav" },
        { index: 3, total: 3, startSec: 600, durationSec: 42, sourceLocalPath: "/tmp/pkaudio-smoke-autocut-order-003.wav" },
      ],
    });

    assert.equal(result.jobs.length, 3, "trim batch should create one job per part");
    assert.deepEqual(result.jobs.map((job) => job.trimPartIndex), [1, 2, 3]);
    assert.deepEqual(result.jobs.map((job) => job.trimPartTotal), [3, 3, 3]);
    assert.deepEqual(result.jobs.map((job) => job.title), [
      "Autocut Smoke Song Part 01/03",
      "Autocut Smoke Song Part 02/03",
      "Autocut Smoke Song Part 03/03",
    ]);
    assert.ok(result.jobs.every((job) => job.sourceUrl === SMOKE_URL), "jobs should keep the original URL for platform/title context");
    assert.ok(result.jobs.every((job) => job.sourceLocalPath?.includes("pkaudio-smoke-autocut-order")), "jobs should point worker to local cut files");

    const latest = await listLatestBatchJobs({ limit: 20 });
    assert.equal(latest.batch?.id, result.batch.id, "latest queue should point to trim batch");
    assert.deepEqual(latest.jobs.map((job) => job.trimPartIndex), [1, 2, 3], "latest queue should preserve trim part order for copy-all code");

    console.log("[smoke] trim batch metadata and latest ordering passed.");
  } finally {
    cleanupSmokeRows();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
