#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runCommand } from "@/lib/system/command";

const dbRelativePath = "./tmp/smoke-auto-cut-media.sqlite";
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
  const smokeDir = path.join(process.cwd(), "tmp", "smoke-auto-cut-media");
  const sourcePath = path.join(smokeDir, "source.wav");
  await fs.rm(smokeDir, { recursive: true, force: true });
  await fs.mkdir(smokeDir, { recursive: true });
  await removeSmokeDb();

  await runCommand(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "sine=frequency=554:duration=7:sample_rate=48000", "-filter:a", "volume=-12dB", sourcePath],
    { timeout: 120000, maxBuffer: 1024 * 1024 * 4 },
  );

  const [{ analyzeAndCutSource, loadAutoCutManifest }, repository, media, { closeDatabaseConnection }] = await Promise.all([
    import("@/lib/trim/preview"),
    import("@/lib/jobs/repository"),
    import("@/lib/worker/media"),
    import("@/lib/db/client"),
  ]);

  try {
    const sourceUrl = pathToFileURL(sourcePath).toString();
    const preview = await analyzeAndCutSource(sourceUrl, { segmentSec: 3 });
    assert(preview.parts.length === 3, `7s fixture with 3s segments should create 3 parts, got ${preview.parts.length}`);
    assert(preview.parts[0]?.durationSec === 3, "first part should be 3 seconds");
    assert(preview.parts[2]?.durationSec && preview.parts[2].durationSec <= 1.1, "last part should contain the remaining ~1 second");

    const manifest = await loadAutoCutManifest(preview.previewId);
    const batch = await repository.createTrimBatch({
      sourceUrl: manifest.sourceUrl,
      sourceTitle: manifest.sourceTitle,
      speed: 1,
      amplifyDb: 0,
      targetLufs: -14,
      quality: "q5",
      audioSafetyMode: "custom",
      headroomDb: -3,
      limiterEnabled: false,
      uploadEnabled: false,
      credentialId: null,
      assetNamePattern: "{title}",
      parts: manifest.parts.map((part) => ({
        index: part.index,
        total: part.total,
        startSec: part.startSec,
        durationSec: part.durationSec,
        sourceLocalPath: part.sourceLocalPath,
        title: part.title,
      })),
    });

    assert(batch.jobs[0]?.title?.endsWith("Part 01/03"), "trim job title should preserve part suffix before worker runs");
    const claimed = await repository.claimNextQueuedJob();
    assert(claimed?.trimPartIndex === 1, "worker should claim first trim part first");
    const processed = await media.processMediaJob(claimed);
    assert(processed, "worker should process local trimmed part successfully");
    const updated = await repository.getJobById(claimed.id);
    assert(updated?.status === "done", `processed trim part should be done, got ${updated?.status}`);
    assert(updated.title?.endsWith("Part 01/03"), `worker should preserve trim part title, got ${updated.title}`);
    assert(updated.outputPath, "processed trim part should have an output path");
    assert(updated.outputDurationSec !== null && updated.outputDurationSec <= 4.5, `converted first part should stay short, got ${updated.outputDurationSec}`);

    console.log("[smoke] auto-cut real-media cut + worker local-part conversion passed.");
  } finally {
    closeDatabaseConnection();
    await Promise.all([removeSmokeDb(), fs.rm(smokeDir, { recursive: true, force: true })]);
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  const { closeDatabaseConnection } = await import("@/lib/db/client");
  closeDatabaseConnection();
  process.exit(1);
});
