import { z } from "zod";
import { AUDIO_QUALITIES, AUDIO_SAFETY_MODES, MAX_HEADROOM_DB, MIN_HEADROOM_DB } from "@/lib/audio/options";

export const settingsPatchSchema = z.object({
  defaultSpeed: z.number().min(0.5).max(3).optional(),
  defaultAmplifyDb: z.number().min(-12).max(12).optional(),
  defaultQuality: z.enum(AUDIO_QUALITIES).optional(),
  defaultAudioSafetyMode: z.enum(AUDIO_SAFETY_MODES).optional(),
  defaultHeadroomDb: z.number().min(MIN_HEADROOM_DB).max(MAX_HEADROOM_DB).optional(),
  defaultLimiterEnabled: z.boolean().optional(),
  defaultUploadEnabled: z.boolean().optional(),
  defaultCredentialId: z.string().trim().min(1).nullable().optional(),
  defaultAssetNamePattern: z.string().trim().min(1).max(120).optional(),
  cleanupTarget: z.enum(["temp", "outputs", "all"]).optional(),
  cleanupRetention: z.enum(["all", "24h", "7d"]).optional(),
  maxConcurrentJobs: z.number().int().min(1).max(4).optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
});

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
