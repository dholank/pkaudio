import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { AUDIO_QUALITIES, AUDIO_SAFETY_MODES } from "@/lib/audio/options";

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creatorType: text("creator_type", { enum: ["user", "group"] }).notNull(),
  creatorId: text("creator_id").notNull(),
  keyPreview: text("key_preview").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  status: text("status", {
    enum: ["untested", "active", "failed", "permission_issue"],
  })
    .notNull()
    .default("untested"),
  lastUsedAt: integer("last_used_at"),
  testedAt: integer("tested_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", {
    enum: ["queued", "active", "done", "failed", "cancelled"],
  })
    .notNull()
    .default("queued"),
  urlCount: integer("url_count").notNull(),
  speed: real("speed").notNull(),
  amplifyDb: real("amplify_db").notNull(),
  targetLufs: real("target_lufs").notNull().default(-14),
  quality: text("quality", { enum: AUDIO_QUALITIES }).notNull(),
  audioSafetyMode: text("audio_safety_mode", { enum: AUDIO_SAFETY_MODES }).notNull().default("roblox_safe"),
  headroomDb: real("headroom_db").notNull().default(-3),
  limiterEnabled: integer("limiter_enabled", { mode: "boolean" }).notNull(),
  uploadEnabled: integer("upload_enabled", { mode: "boolean" }).notNull(),
  credentialId: text("credential_id").references(() => credentials.id, { onDelete: "set null" }),
  credentialName: text("credential_name"),
  assetNamePattern: text("asset_name_pattern").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  sourcePlatform: text("source_platform", { enum: ["youtube", "soundcloud", "unknown"] }).notNull(),
  title: text("title"),
  status: text("status", {
    enum: ["queued", "downloading", "probing", "converting", "converted", "uploading", "done", "failed", "cancelled"],
  })
    .notNull()
    .default("queued"),
  progress: integer("progress").notNull().default(0),
  speed: real("speed").notNull(),
  amplifyDb: real("amplify_db").notNull(),
  targetLufs: real("target_lufs").notNull().default(-14),
  quality: text("quality", { enum: AUDIO_QUALITIES }).notNull(),
  audioSafetyMode: text("audio_safety_mode", { enum: AUDIO_SAFETY_MODES }).notNull().default("roblox_safe"),
  headroomDb: real("headroom_db").notNull().default(-3),
  limiterEnabled: integer("limiter_enabled", { mode: "boolean" }).notNull(),
  uploadEnabled: integer("upload_enabled", { mode: "boolean" }).notNull(),
  credentialId: text("credential_id").references(() => credentials.id, { onDelete: "set null" }),
  credentialName: text("credential_name"),
  assetNamePattern: text("asset_name_pattern").notNull(),
  outputPath: text("output_path"),
  outputDurationSec: real("output_duration_sec"),
  outputSizeBytes: integer("output_size_bytes"),
  outputPeakDb: real("output_peak_db"),
  outputMeanDb: real("output_mean_db"),
  outputSampleRate: integer("output_sample_rate"),
  outputChannels: integer("output_channels"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(1),
  assetId: text("asset_id"),
  robloxOperationId: text("roblox_operation_id"),
  robloxOperationPath: text("roblox_operation_path"),
  robloxOperationStatus: text("roblox_operation_status", { enum: ["none", "pending", "done", "failed", "unknown"] }).notNull().default("none"),
  robloxOperationCheckedAt: integer("roblox_operation_checked_at"),
  robloxOperationRaw: text("roblox_operation_raw"),
  robloxModerationState: text("roblox_moderation_state", { enum: ["none", "reviewing", "approved", "rejected", "unknown", "failed"] }).notNull().default("none"),
  robloxModerationCheckedAt: integer("roblox_moderation_checked_at"),
  robloxModerationRaw: text("roblox_moderation_raw"),
  robloxModerationAttemptCount: integer("roblox_moderation_attempt_count").notNull().default(0),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const jobLogs = sqliteTable("job_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  level: text("level", { enum: ["info", "warn", "error"] }).notNull().default("info"),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const workerHeartbeats = sqliteTable("worker_heartbeats", {
  id: text("id").primaryKey(),
  workerId: text("worker_id").notNull(),
  pid: integer("pid").notNull(),
  hostname: text("hostname").notNull(),
  startedAt: integer("started_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  maxConcurrentJobs: integer("max_concurrent_jobs").notNull(),
  retryCount: integer("retry_count").notNull(),
  activeJobCount: integer("active_job_count").notNull(),
  claimedJobIds: text("claimed_job_ids").notNull(),
});

export const audioPresets = sqliteTable("audio_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  speed: real("speed").notNull(),
  amplifyDb: real("amplify_db").notNull(),
  targetLufs: real("target_lufs").notNull().default(-14),
  quality: text("quality", { enum: AUDIO_QUALITIES }).notNull(),
  audioSafetyMode: text("audio_safety_mode", { enum: AUDIO_SAFETY_MODES }).notNull().default("roblox_safe"),
  headroomDb: real("headroom_db").notNull().default(-3),
  limiterEnabled: integer("limiter_enabled", { mode: "boolean" }).notNull(),
  uploadEnabled: integer("upload_enabled", { mode: "boolean" }).notNull(),
  credentialId: text("credential_id").references(() => credentials.id, { onDelete: "set null" }),
  assetNamePattern: text("asset_name_pattern").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  defaultSpeed: real("default_speed").notNull(),
  defaultAmplifyDb: real("default_amplify_db").notNull(),
  defaultTargetLufs: real("default_target_lufs").notNull().default(-14),
  defaultQuality: text("default_quality", { enum: AUDIO_QUALITIES }).notNull(),
  defaultAudioSafetyMode: text("default_audio_safety_mode", { enum: AUDIO_SAFETY_MODES }).notNull().default("roblox_safe"),
  defaultHeadroomDb: real("default_headroom_db").notNull().default(-3),
  defaultLimiterEnabled: integer("default_limiter_enabled", { mode: "boolean" }).notNull(),
  defaultUploadEnabled: integer("default_upload_enabled", { mode: "boolean" }).notNull(),
  defaultCredentialId: text("default_credential_id").references(() => credentials.id, { onDelete: "set null" }),
  defaultAssetNamePattern: text("default_asset_name_pattern").notNull(),
  cleanupTarget: text("cleanup_target", { enum: ["temp", "outputs", "all"] }).notNull(),
  cleanupRetention: text("cleanup_retention", { enum: ["all", "24h", "7d"] }).notNull(),
  maxConcurrentJobs: integer("max_concurrent_jobs").notNull(),
  retryCount: integer("retry_count").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type CredentialRow = typeof credentials.$inferSelect;
export type NewCredentialRow = typeof credentials.$inferInsert;
export type BatchRow = typeof batches.$inferSelect;
export type NewBatchRow = typeof batches.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
export type JobLogRow = typeof jobLogs.$inferSelect;
export type NewJobLogRow = typeof jobLogs.$inferInsert;
export type WorkerHeartbeatRow = typeof workerHeartbeats.$inferSelect;
export type NewWorkerHeartbeatRow = typeof workerHeartbeats.$inferInsert;
export type AudioPresetRow = typeof audioPresets.$inferSelect;
export type NewAudioPresetRow = typeof audioPresets.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type NewSettingsRow = typeof settings.$inferInsert;
