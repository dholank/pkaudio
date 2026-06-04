import { z } from "zod";
import { AUDIO_QUALITIES, AUDIO_SAFETY_MODES, MAX_HEADROOM_DB, MAX_TARGET_LUFS, MIN_HEADROOM_DB, MIN_TARGET_LUFS } from "@/lib/audio/options";

const batchSettingsSchema = z.object({
  speed: z.number().min(0.5).max(3),
  amplifyDb: z.number().min(-12).max(12),
  targetLufs: z.number().min(MIN_TARGET_LUFS).max(MAX_TARGET_LUFS).default(-14),
  quality: z.enum(AUDIO_QUALITIES),
  audioSafetyMode: z.enum(AUDIO_SAFETY_MODES).default("roblox_safe"),
  headroomDb: z.number().min(MIN_HEADROOM_DB).max(MAX_HEADROOM_DB).default(-3),
  limiterEnabled: z.boolean(),
  uploadEnabled: z.boolean(),
  credentialId: z.string().trim().min(1).nullable().optional(),
  assetNamePattern: z.string().trim().min(1).max(120),
});

export const createBatchSchema = batchSettingsSchema.extend({
  urls: z.array(z.string().trim().url()).min(1).max(100),
});

export const createTrimBatchSchema = batchSettingsSchema.extend({
  previewId: z.string().trim().uuid(),
});

export const listJobsQuerySchema = z.object({
  status: z.string().optional(),
  batchId: z.string().optional(),
  scope: z.enum(["all", "latest"]).optional(),
  q: z.string().optional(),
  platform: z.enum(["all", "youtube", "soundcloud", "unknown"]).optional(),
  credentialId: z.string().optional(),
  upload: z.enum(["all", "uploaded", "pending", "local"]).optional(),
  moderation: z.enum(["all", "none", "reviewing", "approved", "rejected", "unknown", "failed"]).optional(),
  dateRange: z.enum(["all", "today", "week"]).optional(),
  sort: z.enum(["newest", "oldest", "title", "duration", "size", "peak"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const exportJobsQuerySchema = listJobsQuerySchema.extend({
  format: z.enum(["csv", "json"]).default("csv"),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type CreateTrimBatchRequestInput = z.infer<typeof createTrimBatchSchema>;
export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;
export type ExportJobsQueryInput = z.infer<typeof exportJobsQuerySchema>;
