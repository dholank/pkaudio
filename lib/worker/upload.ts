import fs from "node:fs/promises";
import path from "node:path";
import { addJobLog, failJob, updateJobProgress, type AudioDiagnosticsPatch } from "@/lib/jobs/repository";
import type { JobView } from "@/lib/jobs/types";
import { randomAudioName, ROBLOX_AUDIO_DESCRIPTION } from "@/lib/roblox/metadata";
import { renderAssetName, uploadRobloxAudioAsset } from "@/lib/roblox/upload";
import { checkRobloxModerationJob } from "@/lib/worker/moderation";

const cwd = process.cwd();

function resolveOutputPath(outputPath: string) {
  return path.isAbsolute(outputPath) ? outputPath : path.join(cwd, outputPath);
}

function diagnosticsFromJob(job: JobView): AudioDiagnosticsPatch {
  return {
    outputDurationSec: job.outputDurationSec,
    outputSizeBytes: job.outputSizeBytes,
    outputPeakDb: job.outputPeakDb,
    outputMeanDb: job.outputMeanDb,
    outputSampleRate: job.outputSampleRate,
    outputChannels: job.outputChannels,
  };
}

async function assertOutputFile(filePath: string) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error("Converted output path is not a file.");
}

export async function processRobloxUploadJob(job: JobView) {
  try {
    if (!job.uploadEnabled) {
      await failJob(job.id, "Upload worker received a local-only job; this should have been completed by the conversion worker.");
      return false;
    }
    if (!job.credentialId) {
      await failJob(job.id, "Auto upload is enabled but no Roblox credential is attached to this job.");
      return false;
    }
    if (!job.outputPath) {
      await failJob(job.id, "Upload worker could not find a converted OGG output path.");
      return false;
    }

    const outputPath = resolveOutputPath(job.outputPath);
    await assertOutputFile(outputPath);

    const randomName = randomAudioName();
    const displayName = renderAssetName(job.assetNamePattern, {
      title: randomName,
      jobId: job.id,
      platform: job.sourcePlatform,
    });
    const diagnostics = diagnosticsFromJob(job);

    await updateJobProgress(job.id, { status: "uploading", progress: Math.max(job.progress, 92), error: null });
    await addJobLog(job.id, "Serial upload worker started Roblox Creator asset upload.");
    await addJobLog(job.id, `Roblox display name: ${randomName}`);
    await addJobLog(job.id, `Roblox description: ${ROBLOX_AUDIO_DESCRIPTION}`);

    const result = await uploadRobloxAudioAsset({
      credentialId: job.credentialId,
      filePath: outputPath,
      displayName,
      description: ROBLOX_AUDIO_DESCRIPTION,
      diagnostics,
      onLog: async (message) => {
        await addJobLog(job.id, message);
      },
    });

    await updateJobProgress(job.id, {
      status: "done",
      progress: 100,
      outputPath: job.outputPath,
      assetId: result.assetId,
      robloxOperationId: result.operationId,
      robloxOperationPath: result.operationPath,
      robloxOperationStatus: result.operationStatus,
      robloxOperationCheckedAt: Date.now(),
      robloxOperationRaw: JSON.stringify(result.rawOperation),
      robloxModerationState: "reviewing",
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error: null,
    });
    await addJobLog(job.id, `Roblox upload completed. Asset ID: ${result.assetId}. Operation status: ${result.operationStatus}.`);
    await addJobLog(job.id, "Roblox moderation immediate check queued; background worker will keep checking until approved/rejected.");
    await checkRobloxModerationJob({
      ...job,
      status: "done",
      progress: 100,
      assetId: result.assetId,
      robloxOperationId: result.operationId,
      robloxOperationPath: result.operationPath,
      robloxOperationStatus: result.operationStatus,
      robloxOperationCheckedAt: new Date().toISOString(),
      robloxOperationRaw: JSON.stringify(result.rawOperation),
      robloxModerationState: "reviewing",
      robloxModerationCheckedAt: null,
      robloxModerationRaw: null,
      robloxModerationAttemptCount: 0,
      error: null,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Roblox upload worker error.";
    await failJob(job.id, message);
    return false;
  }
}
