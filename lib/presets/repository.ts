import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { audioPresets, type AudioPresetRow, type NewAudioPresetRow } from "@/lib/db/schema";
import type { AudioPresetPayloadInput, AudioPresetPatchInput } from "@/lib/presets/validation";
import type { AudioPresetView } from "@/lib/presets/types";

function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function toAudioPresetView(row: AudioPresetRow): AudioPresetView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    speed: row.speed,
    amplifyDb: row.amplifyDb,
    quality: row.quality,
    audioSafetyMode: row.audioSafetyMode,
    headroomDb: row.headroomDb,
    limiterEnabled: row.limiterEnabled,
    uploadEnabled: row.uploadEnabled,
    credentialId: row.credentialId,
    assetNamePattern: row.assetNamePattern,
    isDefault: row.isDefault,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePresetPayload(input: AudioPresetPayloadInput) {
  return {
    name: input.name.trim(),
    description: normalizeNullableString(input.description),
    speed: input.speed,
    amplifyDb: input.amplifyDb,
    quality: input.quality,
    audioSafetyMode: input.audioSafetyMode,
    headroomDb: input.headroomDb,
    limiterEnabled: input.limiterEnabled,
    uploadEnabled: input.uploadEnabled,
    credentialId: normalizeNullableString(input.credentialId),
    assetNamePattern: input.assetNamePattern.trim(),
    isDefault: Boolean(input.isDefault),
  };
}

async function clearDefaultPreset(exceptId?: string) {
  const db = getDb();
  const rows = db.select().from(audioPresets).all();
  const now = Date.now();
  for (const row of rows) {
    if (row.isDefault && row.id !== exceptId) {
      db.update(audioPresets).set({ isDefault: false, updatedAt: now }).where(eq(audioPresets.id, row.id)).run();
    }
  }
}

export async function listAudioPresets() {
  return getDb().select().from(audioPresets).orderBy(desc(audioPresets.isDefault), desc(audioPresets.updatedAt)).all().map(toAudioPresetView);
}

export async function getAudioPresetById(id: string) {
  return getDb().select().from(audioPresets).where(eq(audioPresets.id, id)).get() ?? null;
}

export async function getDefaultAudioPreset() {
  return getDb().select().from(audioPresets).where(eq(audioPresets.isDefault, true)).orderBy(desc(audioPresets.updatedAt)).get() ?? null;
}

export async function createAudioPreset(input: AudioPresetPayloadInput) {
  const data = normalizePresetPayload(input);
  const now = Date.now();
  const row: NewAudioPresetRow = {
    id: randomUUID(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  if (row.isDefault) await clearDefaultPreset();
  getDb().insert(audioPresets).values(row).run();
  return toAudioPresetView(row as AudioPresetRow);
}

export async function updateAudioPreset(id: string, input: AudioPresetPatchInput) {
  const existing = await getAudioPresetById(id);
  if (!existing) return null;

  const patch: Partial<NewAudioPresetRow> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = normalizeNullableString(input.description);
  if (input.speed !== undefined) patch.speed = input.speed;
  if (input.amplifyDb !== undefined) patch.amplifyDb = input.amplifyDb;
  if (input.quality !== undefined) patch.quality = input.quality;
  if (input.audioSafetyMode !== undefined) patch.audioSafetyMode = input.audioSafetyMode;
  if (input.headroomDb !== undefined) patch.headroomDb = input.headroomDb;
  if (input.limiterEnabled !== undefined) patch.limiterEnabled = input.limiterEnabled;
  if (input.uploadEnabled !== undefined) patch.uploadEnabled = input.uploadEnabled;
  if (input.credentialId !== undefined) patch.credentialId = normalizeNullableString(input.credentialId);
  if (input.assetNamePattern !== undefined) patch.assetNamePattern = input.assetNamePattern.trim();
  if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

  if (patch.isDefault) await clearDefaultPreset(id);
  const now = Date.now();
  getDb().update(audioPresets).set({ ...patch, updatedAt: now }).where(eq(audioPresets.id, id)).run();
  const updated = await getAudioPresetById(id);
  return updated ? toAudioPresetView(updated) : null;
}

export async function deleteAudioPreset(id: string) {
  const existing = await getAudioPresetById(id);
  if (!existing) return null;
  getDb().delete(audioPresets).where(eq(audioPresets.id, id)).run();
  return toAudioPresetView(existing);
}
