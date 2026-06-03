import type { AudioQuality, AudioSafetyMode } from "@/lib/audio/options";

export type AudioPresetView = {
  id: string;
  name: string;
  description: string | null;
  speed: number;
  amplifyDb: number;
  targetLufs: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId: string | null;
  assetNamePattern: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
