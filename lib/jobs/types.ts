import type { AudioQuality, AudioSafetyMode } from "@/lib/audio/options";

export type BatchStatus = "queued" | "active" | "done" | "failed" | "cancelled";

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

export type SourcePlatform = "youtube" | "soundcloud" | "unknown";

export type RobloxOperationStatus = "none" | "pending" | "done" | "failed" | "unknown";
export type RobloxModerationState = "none" | "reviewing" | "approved" | "rejected" | "unknown" | "failed";

export type BatchView = {
  id: string;
  name: string;
  status: BatchStatus;
  urlCount: number;
  speed: number;
  amplifyDb: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId: string | null;
  credentialName: string | null;
  assetNamePattern: string;
  createdAt: string;
  updatedAt: string;
};

export type JobView = {
  id: string;
  batchId: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  title: string | null;
  status: JobStatus;
  progress: number;
  speed: number;
  amplifyDb: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId: string | null;
  credentialName: string | null;
  assetNamePattern: string;
  outputPath: string | null;
  outputDurationSec: number | null;
  outputSizeBytes: number | null;
  outputPeakDb: number | null;
  outputMeanDb: number | null;
  outputSampleRate: number | null;
  outputChannels: number | null;
  attemptCount: number;
  maxAttempts: number;
  assetId: string | null;
  robloxOperationId: string | null;
  robloxOperationPath: string | null;
  robloxOperationStatus: RobloxOperationStatus;
  robloxOperationCheckedAt: string | null;
  robloxOperationRaw: string | null;
  robloxModerationState: RobloxModerationState;
  robloxModerationCheckedAt: string | null;
  robloxModerationRaw: string | null;
  robloxModerationAttemptCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobLogView = {
  id: string;
  jobId: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};
