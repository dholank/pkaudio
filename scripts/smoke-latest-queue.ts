import assert from "node:assert/strict";
import { inArray, like } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { batches, jobs } from "@/lib/db/schema";
import { createBatch, listLatestBatchJobs } from "@/lib/jobs/repository";

function cleanupSmokeRows() {
  const db = getDb();
  const rows = db
    .select({ id: jobs.id, batchId: jobs.batchId })
    .from(jobs)
    .where(like(jobs.sourceUrl, "%pkaudio-smoke-latest-queue%"))
    .all();
  const batchIds = [...new Set(rows.map((row) => row.batchId))];
  if (rows.length) db.delete(jobs).where(inArray(jobs.id, rows.map((row) => row.id))).run();
  if (batchIds.length) db.delete(batches).where(inArray(batches.id, batchIds)).run();
}

async function main() {
  cleanupSmokeRows();

  try {
    const first = await createBatch({
      urls: ["https://youtu.be/pkaudio-smoke-latest-queue-old"],
      speed: 1,
      amplifyDb: 0,
      targetLufs: -14,
      quality: "q7",
      audioSafetyMode: "roblox_safe",
      headroomDb: -3,
      limiterEnabled: true,
      uploadEnabled: false,
      credentialId: null,
      assetNamePattern: "{title}",
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const latest = await createBatch({
      urls: ["https://youtu.be/pkaudio-smoke-latest-queue-new-a", "https://youtu.be/pkaudio-smoke-latest-queue-new-b"],
      speed: 2.3,
      amplifyDb: -2,
      targetLufs: -14,
      quality: "q7",
      audioSafetyMode: "roblox_safe",
      headroomDb: -3,
      limiterEnabled: true,
      uploadEnabled: false,
      credentialId: null,
      assetNamePattern: "{title}",
    });

    const result = await listLatestBatchJobs({ limit: 20 });

    assert.equal(result.batch?.id, latest.batch.id, "latest queue should use newest batch id");
    assert.equal(result.jobs.length, 2, "latest queue should only include jobs from newest batch");
    assert.deepEqual(new Set(result.jobs.map((job) => job.batchId)), new Set([latest.batch.id]));
    assert.ok(!result.jobs.some((job) => job.batchId === first.batch.id), "older batch jobs should not be returned");

    console.log(`latest queue smoke passed: batch=${result.batch.id} jobs=${result.jobs.length}`);
  } finally {
    cleanupSmokeRows();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
