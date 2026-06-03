import type { AudioQuality } from "@/lib/audio/options";

export type CredentialStatus = "untested" | "active" | "failed" | "permission_issue";

export type Credential = {
  id: string;
  name: string;
  creatorType: "user" | "group";
  creatorId: string;
  keyPreview: string;
  status: CredentialStatus;
  lastUsedAt?: string;
  createdAt: string;
};

export type JobStatus =
  | "queued"
  | "downloading"
  | "probing"
  | "converting"
  | "converted"
  | "uploading"
  | "done"
  | "failed"
  | "cancelled";

export type Job = {
  id: string;
  batchId: string;
  sourceUrl: string;
  sourcePlatform: "youtube" | "soundcloud" | "unknown";
  title?: string;
  status: JobStatus;
  progress: number;
  speed: number;
  amplifyDb: number;
  quality: AudioQuality;
  limiterEnabled: boolean;
  credentialName?: string;
  outputPath?: string;
  assetId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export const mockCredentials: Credential[] = [
  {
    id: "cred_group_main",
    name: "Group Upload Key",
    creatorType: "group",
    creatorId: "987654",
    keyPreview: "rbx_••••••••Q9x2",
    status: "active",
    lastUsedAt: "Today",
    createdAt: "2026-06-01",
  },
  {
    id: "cred_user_private",
    name: "Private User Key",
    creatorType: "user",
    creatorId: "123456",
    keyPreview: "rbx_••••••••A1p0",
    status: "untested",
    lastUsedAt: "Never",
    createdAt: "2026-06-01",
  },
];

export const mockJobs: Job[] = [
  {
    id: "job_01",
    batchId: "batch_alpha",
    sourceUrl: "https://www.youtube.com/watch?v=mock-alpha",
    sourcePlatform: "youtube",
    title: "Fast phonk loop - mock preview",
    status: "converting",
    progress: 64,
    speed: 2.3,
    amplifyDb: 3,
    quality: "q7",
    limiterEnabled: true,
    credentialName: "Group Upload Key",
    createdAt: "12:03",
    updatedAt: "12:05",
  },
  {
    id: "job_02",
    batchId: "batch_alpha",
    sourceUrl: "https://soundcloud.com/example/mock-track",
    sourcePlatform: "soundcloud",
    title: "SoundCloud drift sample",
    status: "uploading",
    progress: 82,
    speed: 2.3,
    amplifyDb: 3,
    quality: "q7",
    limiterEnabled: true,
    credentialName: "Group Upload Key",
    createdAt: "12:04",
    updatedAt: "12:06",
  },
  {
    id: "job_03",
    batchId: "batch_alpha",
    sourceUrl: "https://www.youtube.com/watch?v=mock-done",
    sourcePlatform: "youtube",
    title: "Uploaded Roblox hit marker",
    status: "done",
    progress: 100,
    speed: 2.3,
    amplifyDb: 3,
    quality: "q7",
    limiterEnabled: true,
    credentialName: "Group Upload Key",
    assetId: "1234567890",
    outputPath: "outputs/job_03.ogg",
    createdAt: "11:58",
    updatedAt: "12:01",
  },
  {
    id: "job_04",
    batchId: "batch_alpha",
    sourceUrl: "https://www.youtube.com/watch?v=mock-failed",
    sourcePlatform: "youtube",
    title: "Failed upload permission case",
    status: "failed",
    progress: 100,
    speed: 2.3,
    amplifyDb: 3,
    quality: "q7",
    limiterEnabled: true,
    credentialName: "Private User Key",
    error: "Roblox upload failed: API key missing asset upload permission.",
    outputPath: "outputs/job_04.ogg",
    createdAt: "11:40",
    updatedAt: "11:44",
  },
];

export const systemChecks = [
  { name: "SQLite", status: "Ready", detail: "Local credentials, batches, jobs, and logs", ok: true },
  { name: "AES-256-GCM", status: "Ready", detail: "Credential encryption", ok: true },
  { name: "Queue DB", status: "Ready", detail: "Batch/job persistence active", ok: true },
  { name: "ffmpeg", status: "Pending", detail: "OGG Vorbis encoding comes in Phase 4", ok: false },
  { name: "ffprobe", status: "Pending", detail: "Dynamic sample-rate detection comes in Phase 4", ok: false },
  { name: "yt-dlp", status: "Pending", detail: "YouTube / SoundCloud extractor comes in Phase 4", ok: false },
  { name: "Redis", status: "Mock", detail: "BullMQ comes in Phase 3", ok: false },
  { name: "Worker", status: "Mock", detail: "BullMQ worker comes in Phase 3", ok: false },
];
