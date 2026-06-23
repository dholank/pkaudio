import type { JobView } from "@/lib/jobs/types";

export const DEFAULT_AUDIO_IMAGE_ID = "rbxassetid://131267688688616";
export const DEFAULT_AUTO_CUT_AUDIO_IMAGE_ID = "rbxassetid://95717589436679";
export const DEFAULT_MODULE_IMAGE_ID = "rbxassetid://117962161032308";
export const DEFAULT_AUDIO_PLAYBACK_SPEED = "0.435";

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

function autoCutSongName(job: JobView) {
  const title = job.title ?? "Untitled audio";
  return title.replace(/\s+Part\s+\d+\/\d+$/i, "").trim() || title;
}

export function robloxAutoCutAudioCode(jobs: readonly JobView[]) {
  const trimJobs = sortJobsForRobloxAudioCode(jobs.filter((job) => job.assetId && job.trimPartIndex !== null));
  if (!trimJobs.length) return "";

  const songName = autoCutSongName(trimJobs[0]);
  return [
    "\t\t\t{",
    `\t\t\t\tSongName = "${luaString(songName)}",`,
    "\t\t\t\tSoundIds = {",
    ...trimJobs.map((job) => `\t\t\t\t\t"${assetUri(job.assetId!)}",`),
    "\t\t\t\t},",
    `\t\t\t\tImageId = "${DEFAULT_AUTO_CUT_AUDIO_IMAGE_ID}",`,
    `\t\t\t\tPlaybackSpeed = ${DEFAULT_AUDIO_PLAYBACK_SPEED},`,
    "\t\t\t},",
  ].join("\n");
}

export function robloxModuleCode(jobs: readonly JobView[]) {
  const uploaded = sortJobsForRobloxAudioCode(jobs.filter((job) => job.assetId));
  if (!uploaded.length) return "";

  const lines: string[] = [];
  lines.push("local module = {");
  lines.push(`\t{`);
  lines.push(`\t\tName = "PKAudio",`);
  lines.push(`\t\tImage = "${DEFAULT_MODULE_IMAGE_ID}",`);
  lines.push(`\t\tSongs = {`);

  for (const job of uploaded) {
    const name = job.title ?? "Untitled";
    lines.push(`\t\t\t{ Id = ${job.assetId}, Name = "${luaString(name)}", PlaybackSpeed = ${DEFAULT_AUDIO_PLAYBACK_SPEED} },`);
  }

  lines.push(`\t\t},`);
  lines.push(`\t},`);
  lines.push("}");
  lines.push("");
  lines.push("return module");

  return lines.join("\n");
}
