import type { AudioQuality, AudioSafetyMode } from "@/lib/audio/options";

export type CleanupTarget = "temp" | "outputs" | "all";
export type CleanupRetention = "all" | "24h" | "7d";

export type AppSettingsView = {
  id: string;
  defaultSpeed: number;
  defaultAmplifyDb: number;
  defaultQuality: AudioQuality;
  defaultAudioSafetyMode: AudioSafetyMode;
  defaultHeadroomDb: number;
  defaultLimiterEnabled: boolean;
  defaultUploadEnabled: boolean;
  defaultCredentialId: string | null;
  defaultAssetNamePattern: string;
  cleanupTarget: CleanupTarget;
  cleanupRetention: CleanupRetention;
  maxConcurrentJobs: number;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
};
