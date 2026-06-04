#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { robloxAudioCode, sortJobsForRobloxAudioCode } from "@/lib/roblox/audio-code";
import type { JobView } from "@/lib/jobs/types";

function job(overrides: Partial<JobView>): JobView {
  return {
    id: overrides.id ?? "job",
    batchId: "batch",
    sourceUrl: "https://youtu.be/example",
    sourcePlatform: "youtube",
    title: overrides.title ?? null,
    status: "done",
    progress: 100,
    speed: 1,
    amplifyDb: 0,
    targetLufs: -14,
    quality: "q7",
    audioSafetyMode: "roblox_safe",
    headroomDb: -3,
    limiterEnabled: true,
    uploadEnabled: true,
    credentialId: null,
    credentialName: null,
    assetNamePattern: "{title}",
    sourceLocalPath: overrides.sourceLocalPath ?? null,
    trimGroupId: overrides.trimGroupId ?? null,
    trimOriginalUrl: overrides.trimOriginalUrl ?? null,
    trimPartIndex: overrides.trimPartIndex ?? null,
    trimPartTotal: overrides.trimPartTotal ?? null,
    trimStartSec: overrides.trimStartSec ?? null,
    trimDurationSec: overrides.trimDurationSec ?? null,
    outputPath: null,
    outputDurationSec: null,
    outputSizeBytes: null,
    outputPeakDb: null,
    outputMeanDb: null,
    outputSampleRate: null,
    outputChannels: null,
    attemptCount: 1,
    maxAttempts: 1,
    assetId: overrides.assetId ?? null,
    robloxOperationId: null,
    robloxOperationPath: null,
    robloxOperationStatus: "done",
    robloxOperationCheckedAt: null,
    robloxOperationRaw: null,
    robloxModerationState: "approved",
    robloxModerationCheckedAt: null,
    robloxModerationRaw: null,
    robloxModerationAttemptCount: 0,
    error: null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const unordered = [
  job({ id: "part-3", title: "Song Part 03/03", assetId: "333", trimGroupId: "g", trimPartIndex: 3, trimPartTotal: 3 }),
  job({ id: "part-1", title: "Song Part 01/03", assetId: "111", trimGroupId: "g", trimPartIndex: 1, trimPartTotal: 3 }),
  job({ id: "part-2", title: "Song Part 02/03", assetId: "222", trimGroupId: "g", trimPartIndex: 2, trimPartTotal: 3 }),
];

const sorted = sortJobsForRobloxAudioCode(unordered);
assert.deepEqual(sorted.map((item) => item.assetId), ["111", "222", "333"], "copy-all code should sort trim parts by part index");

const code = robloxAudioCode(sorted[0]);
assert.ok(code.includes('SongName = "Song Part 01/03"'), "Lua code should include stable part title");
assert.ok(code.includes('SoundId = "rbxassetid://111"'), "Lua code should include SoundId URI");
assert.ok(code.includes("PlaybackSpeed = 0.43"), "Lua code should keep fixed Roblox playback speed");

console.log("[smoke] Roblox audio code ordering passed.");
