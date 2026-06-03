import { z } from "zod";
import { AUDIO_QUALITIES, AUDIO_SAFETY_MODES, MAX_HEADROOM_DB, MIN_HEADROOM_DB } from "@/lib/audio/options";

const qualitySchema = z.enum(AUDIO_QUALITIES);

export const audioPresetPayloadSchema = z.object({
  name: z.string().trim().min(1, "Preset name is required.").max(80, "Preset name is too long."),
  description: z.string().trim().max(240, "Description is too long.").optional().nullable(),
  speed: z.coerce.number().min(0.5).max(3),
  amplifyDb: z.coerce.number().min(-12).max(12),
  quality: qualitySchema,
  audioSafetyMode: z.enum(AUDIO_SAFETY_MODES).default("roblox_safe"),
  headroomDb: z.coerce.number().min(MIN_HEADROOM_DB).max(MAX_HEADROOM_DB).default(-3),
  limiterEnabled: z.coerce.boolean(),
  uploadEnabled: z.coerce.boolean(),
  credentialId: z.string().trim().min(1).optional().nullable(),
  assetNamePattern: z.string().trim().min(1).max(120),
  isDefault: z.coerce.boolean().optional(),
});

export const audioPresetPatchSchema = audioPresetPayloadSchema.partial().refine((value) => Object.keys(value).length > 0, "No changes provided.");

export type AudioPresetPayloadInput = z.infer<typeof audioPresetPayloadSchema>;
export type AudioPresetPatchInput = z.infer<typeof audioPresetPatchSchema>;
