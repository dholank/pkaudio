import type { JobView } from "@/lib/jobs/types";

export const DEFAULT_AUDIO_IMAGE_ID = "rbxassetid://131267688688616";
export const DEFAULT_AUDIO_PLAYBACK_SPEED = "0.43";

export function assetUri(assetId: string) {
  return `rbxassetid://${assetId}`;
}

export function luaString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function createdAtMs(job: JobView) {
  const value = Date.parse(job.createdAt);
  return Number.isFinite(value) ? value : 0;
}

function trimGroupKey(job: JobView) {
  return job.trimGroupId ?? job.batchId;
}

export function sortJobsForRobloxAudioCode<T extends JobView>(jobs: readonly T[]) {
  return [...jobs].sort((a, b) => {
    const aPart = a.trimPartIndex;
    const bPart = b.trimPartIndex;
    if (aPart !== null && bPart !== null) {
      const groupCompare = trimGroupKey(a).localeCompare(trimGroupKey(b));
      if (groupCompare !== 0) return groupCompare;
      return aPart - bPart;
    }
    if (aPart !== null) return -1;
    if (bPart !== null) return 1;
    const createdCompare = createdAtMs(a) - createdAtMs(b);
    if (createdCompare !== 0) return createdCompare;
    return a.id.localeCompare(b.id);
  });
}

export function robloxAudioCode(job: JobView) {
  if (!job.assetId) return "";
  return [
    "\t\t\t{",
    `\t\t\tSongName = "${luaString(job.title ?? "Untitled audio")}",`,
    `\t\t\tSoundId = "${assetUri(job.assetId)}",`,
    `\t\t\tImageId = "${DEFAULT_AUDIO_IMAGE_ID}",`,
    `\t\t\tPlaybackSpeed = ${DEFAULT_AUDIO_PLAYBACK_SPEED},`,
    "\t\t\t},",
  ].join("\n");
}
