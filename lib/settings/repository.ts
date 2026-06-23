import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getCredentialById } from "@/lib/credentials/repository";
import { settings, type NewSettingsRow, type SettingsRow } from "@/lib/db/schema";
import type { AppSettingsView } from "@/lib/settings/types";
import type { SettingsPatchInput } from "@/lib/settings/validation";

export const SETTINGS_ID = "app";

export const DEFAULT_SETTINGS = {
  defaultSpeed: 2.3,
  defaultAmplifyDb: 0,
  defaultTargetLufs: -14,
  defaultQuality: "q7" as const,
  defaultAudioSafetyMode: "roblox_safe" as const,
  defaultHeadroomDb: -3,
  defaultLimiterEnabled: true,
  defaultUploadEnabled: true,
  defaultCredentialId: null as string | null,
  defaultAssetNamePattern: "{title}",
  cleanupTarget: "temp" as const,
  cleanupRetention: "all" as const,
  maxConcurrentJobs: 2,
  retryCount: 2,
};

function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function toSettingsView(row: SettingsRow): AppSettingsView {
  return {
    id: row.id,
    defaultSpeed: row.defaultSpeed,
    defaultAmplifyDb: row.defaultAmplifyDb,
    defaultTargetLufs: row.defaultTargetLufs,
    defaultQuality: row.defaultQuality,
    defaultAudioSafetyMode: row.defaultAudioSafetyMode,
    defaultHeadroomDb: row.defaultHeadroomDb,
    defaultLimiterEnabled: row.defaultLimiterEnabled,
    defaultUploadEnabled: row.defaultUploadEnabled,
    defaultCredentialId: row.defaultCredentialId,
    defaultAssetNamePattern: row.defaultAssetNamePattern,
    cleanupTarget: row.cleanupTarget,
    cleanupRetention: row.cleanupRetention,
    maxConcurrentJobs: row.maxConcurrentJobs,
    retryCount: row.retryCount,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function defaultRow(now = Date.now()): NewSettingsRow {
  return {
    id: SETTINGS_ID,
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSettingsRow(): Promise<SettingsRow> {
  const db = getDb();
  const existing = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  if (existing) return existing;

  const row = defaultRow();
  db.insert(settings).values(row).run();
  const inserted = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  if (!inserted) throw new Error("Failed to initialize app settings.");
  return inserted;
}

export async function getSettings() {
  return toSettingsView(await getSettingsRow());
}

export async function updateSettings(input: SettingsPatchInput) {
  const existing = await getSettingsRow();

  if (input.defaultUploadEnabled && input.defaultCredentialId) {
    const credential = await getCredentialById(input.defaultCredentialId);
    if (!credential) throw new Error("Selected default credential was not found.");
  }

  if (input.defaultCredentialId) {
    const credential = await getCredentialById(input.defaultCredentialId);
    if (!credential) throw new Error("Selected default credential was not found.");
  }

  const patch: Partial<SettingsRow> = {
    ...input,
    updatedAt: Date.now(),
  };

  getDb().update(settings).set(patch).where(eq(settings.id, existing.id)).run();
  return getSettings();
}

export async function resetSettings() {
  const now = Date.now();
  const existing = await getSettingsRow();
  getDb()
    .update(settings)
    .set({ ...DEFAULT_SETTINGS, createdAt: existing.createdAt, updatedAt: now })
    .where(eq(settings.id, SETTINGS_ID))
    .run();
  return getSettings();
}
