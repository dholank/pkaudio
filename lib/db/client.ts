import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

type SqliteDatabase = Database.Database;
type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & {
  __pkaudioSqlite?: SqliteDatabase;
  __pkaudioDb?: DrizzleDatabase;
};

function getDatabasePath() {
  const configuredPath = process.env.PKAUDIO_DB_PATH ?? "./data/pkaudio.sqlite";
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredPath);
}

function ensureSchema(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      creator_type TEXT NOT NULL CHECK (creator_type IN ('user', 'group')),
      creator_id TEXT NOT NULL,
      key_preview TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'untested' CHECK (status IN ('untested', 'active', 'failed', 'permission_issue')),
      last_used_at INTEGER,
      tested_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'done', 'failed', 'cancelled')),
      url_count INTEGER NOT NULL,
      speed REAL NOT NULL,
      amplify_db REAL NOT NULL,
      target_lufs REAL NOT NULL DEFAULT -14,
      quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
      audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      headroom_db REAL NOT NULL DEFAULT -3,
      limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
      upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      credential_name TEXT,
      asset_name_pattern TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      source_platform TEXT NOT NULL CHECK (source_platform IN ('youtube', 'soundcloud', 'unknown')),
      title TEXT,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'downloading', 'probing', 'converting', 'converted', 'uploading', 'done', 'failed', 'cancelled')),
      progress INTEGER NOT NULL DEFAULT 0,
      speed REAL NOT NULL,
      amplify_db REAL NOT NULL,
      target_lufs REAL NOT NULL DEFAULT -14,
      quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
      audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      headroom_db REAL NOT NULL DEFAULT -3,
      limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
      upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      credential_name TEXT,
      asset_name_pattern TEXT NOT NULL,
      source_local_path TEXT,
      trim_group_id TEXT,
      trim_original_url TEXT,
      trim_part_index INTEGER,
      trim_part_total INTEGER,
      trim_start_sec REAL,
      trim_duration_sec REAL,
      output_path TEXT,
      output_duration_sec REAL,
      output_size_bytes INTEGER,
      output_peak_db REAL,
      output_mean_db REAL,
      output_sample_rate INTEGER,
      output_channels INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 1,
      asset_id TEXT,
      roblox_operation_id TEXT,
      roblox_operation_path TEXT,
      roblox_operation_status TEXT NOT NULL DEFAULT 'none' CHECK (roblox_operation_status IN ('none', 'pending', 'done', 'failed', 'unknown')),
      roblox_operation_checked_at INTEGER,
      roblox_operation_raw TEXT,
      roblox_moderation_state TEXT NOT NULL DEFAULT 'none' CHECK (roblox_moderation_state IN ('none', 'reviewing', 'approved', 'rejected', 'unknown', 'failed')),
      roblox_moderation_checked_at INTEGER,
      roblox_moderation_raw TEXT,
      roblox_moderation_attempt_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id TEXT PRIMARY KEY NOT NULL,
      worker_id TEXT NOT NULL,
      pid INTEGER NOT NULL,
      hostname TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      max_concurrent_jobs INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      active_job_count INTEGER NOT NULL,
      claimed_job_ids TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      default_speed REAL NOT NULL,
      default_amplify_db REAL NOT NULL,
      default_target_lufs REAL NOT NULL DEFAULT -14,
      default_quality TEXT NOT NULL CHECK (default_quality IN ('q5', 'q6', 'q7', 'q8')),
      default_audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (default_audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      default_headroom_db REAL NOT NULL DEFAULT -3,
      default_limiter_enabled INTEGER NOT NULL CHECK (default_limiter_enabled IN (0, 1)),
      default_upload_enabled INTEGER NOT NULL CHECK (default_upload_enabled IN (0, 1)),
      default_credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      default_asset_name_pattern TEXT NOT NULL,
      cleanup_target TEXT NOT NULL CHECK (cleanup_target IN ('temp', 'outputs', 'all')),
      cleanup_retention TEXT NOT NULL CHECK (cleanup_retention IN ('all', '24h', '7d')),
      max_concurrent_jobs INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS credentials_creator_idx
      ON credentials (creator_type, creator_id);

    CREATE INDEX IF NOT EXISTS credentials_status_idx
      ON credentials (status);

    CREATE INDEX IF NOT EXISTS batches_created_at_idx
      ON batches (created_at);

    CREATE INDEX IF NOT EXISTS batches_status_idx
      ON batches (status);

    CREATE INDEX IF NOT EXISTS jobs_batch_idx
      ON jobs (batch_id);

    CREATE INDEX IF NOT EXISTS jobs_status_idx
      ON jobs (status);

    CREATE INDEX IF NOT EXISTS jobs_created_at_idx
      ON jobs (created_at);

    CREATE INDEX IF NOT EXISTS job_logs_job_idx
      ON job_logs (job_id, created_at);

    CREATE INDEX IF NOT EXISTS worker_heartbeats_last_seen_idx
      ON worker_heartbeats (last_seen_at);

    CREATE INDEX IF NOT EXISTS worker_heartbeats_worker_idx
      ON worker_heartbeats (worker_id);

    CREATE TABLE IF NOT EXISTS audio_presets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      speed REAL NOT NULL,
      amplify_db REAL NOT NULL,
      target_lufs REAL NOT NULL DEFAULT -14,
      quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
      audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      headroom_db REAL NOT NULL DEFAULT -3,
      limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
      upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      asset_name_pattern TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS audio_presets_default_idx
      ON audio_presets (is_default, updated_at);

    CREATE INDEX IF NOT EXISTS audio_presets_name_idx
      ON audio_presets (name);

    CREATE INDEX IF NOT EXISTS settings_updated_at_idx
      ON settings (updated_at);
  `);
}


function ensureColumn(sqlite: SqliteDatabase, table: string, column: string, definition: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const columns = new Set(rows.map((row) => row.name));
  if (!columns.has(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function ensureSettingsMigrations(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      default_speed REAL NOT NULL,
      default_amplify_db REAL NOT NULL,
      default_target_lufs REAL NOT NULL DEFAULT -14,
      default_quality TEXT NOT NULL CHECK (default_quality IN ('q5', 'q6', 'q7', 'q8')),
      default_audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (default_audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      default_headroom_db REAL NOT NULL DEFAULT -3,
      default_limiter_enabled INTEGER NOT NULL CHECK (default_limiter_enabled IN (0, 1)),
      default_upload_enabled INTEGER NOT NULL CHECK (default_upload_enabled IN (0, 1)),
      default_credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      default_asset_name_pattern TEXT NOT NULL,
      cleanup_target TEXT NOT NULL CHECK (cleanup_target IN ('temp', 'outputs', 'all')),
      cleanup_retention TEXT NOT NULL CHECK (cleanup_retention IN ('all', '24h', '7d')),
      max_concurrent_jobs INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function ensureAudioPresetMigrations(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audio_presets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      speed REAL NOT NULL,
      amplify_db REAL NOT NULL,
      target_lufs REAL NOT NULL DEFAULT -14,
      quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
      audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
      headroom_db REAL NOT NULL DEFAULT -3,
      limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
      upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
      credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
      asset_name_pattern TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS audio_presets_default_idx
      ON audio_presets (is_default, updated_at);

    CREATE INDEX IF NOT EXISTS audio_presets_name_idx
      ON audio_presets (name);
  `);
}

function ensureWorkerHeartbeatMigrations(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id TEXT PRIMARY KEY NOT NULL,
      worker_id TEXT NOT NULL,
      pid INTEGER NOT NULL,
      hostname TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      max_concurrent_jobs INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      active_job_count INTEGER NOT NULL,
      claimed_job_ids TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS worker_heartbeats_last_seen_idx
      ON worker_heartbeats (last_seen_at);

    CREATE INDEX IF NOT EXISTS worker_heartbeats_worker_idx
      ON worker_heartbeats (worker_id);
  `);
}

function tableSql(sqlite: SqliteDatabase, table: string) {
  const row = sqlite.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table) as { sql?: string } | undefined;
  return row?.sql ?? "";
}

function needsAdvancedAudioRebuild(sqlite: SqliteDatabase) {
  return ["batches", "jobs", "settings", "audio_presets"].some((table) => {
    const sql = tableSql(sqlite, table);
    const needsQualityRebuild = sql.includes("quality IN ('q6', 'q7')") || sql.includes("default_quality IN ('q6', 'q7')");
    const needsConvertedStatusRebuild = table === "jobs" && sql.includes("'converting', 'uploading'") && !sql.includes("'converted'");
    return needsQualityRebuild || needsConvertedStatusRebuild;
  });
}

function ensureAdvancedAudioTableMigrations(sqlite: SqliteDatabase) {
  if (!needsAdvancedAudioRebuild(sqlite)) return;

  sqlite.exec("PRAGMA foreign_keys = OFF");
  try {
    sqlite.exec(`
      BEGIN;

      CREATE TABLE batches_new (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'done', 'failed', 'cancelled')),
        url_count INTEGER NOT NULL,
        speed REAL NOT NULL,
        amplify_db REAL NOT NULL,
        target_lufs REAL NOT NULL DEFAULT -14,
        quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
        audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
        headroom_db REAL NOT NULL DEFAULT -3,
        limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
        upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
        credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
        credential_name TEXT,
        asset_name_pattern TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE jobs_new (
        id TEXT PRIMARY KEY NOT NULL,
        batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL,
        source_platform TEXT NOT NULL CHECK (source_platform IN ('youtube', 'soundcloud', 'unknown')),
        title TEXT,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'downloading', 'probing', 'converting', 'converted', 'uploading', 'done', 'failed', 'cancelled')),
        progress INTEGER NOT NULL DEFAULT 0,
        speed REAL NOT NULL,
        amplify_db REAL NOT NULL,
        target_lufs REAL NOT NULL DEFAULT -14,
        quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
        audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
        headroom_db REAL NOT NULL DEFAULT -3,
        limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
        upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
        credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
        credential_name TEXT,
        asset_name_pattern TEXT NOT NULL,
        source_local_path TEXT,
        trim_group_id TEXT,
        trim_original_url TEXT,
        trim_part_index INTEGER,
        trim_part_total INTEGER,
        trim_start_sec REAL,
        trim_duration_sec REAL,
        output_path TEXT,
        output_duration_sec REAL,
        output_size_bytes INTEGER,
        output_peak_db REAL,
        output_mean_db REAL,
        output_sample_rate INTEGER,
        output_channels INTEGER,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        asset_id TEXT,
        roblox_operation_id TEXT,
        roblox_operation_path TEXT,
        roblox_operation_status TEXT NOT NULL DEFAULT 'none' CHECK (roblox_operation_status IN ('none', 'pending', 'done', 'failed', 'unknown')),
        roblox_operation_checked_at INTEGER,
        roblox_operation_raw TEXT,
        roblox_moderation_state TEXT NOT NULL DEFAULT 'none' CHECK (roblox_moderation_state IN ('none', 'reviewing', 'approved', 'rejected', 'unknown', 'failed')),
        roblox_moderation_checked_at INTEGER,
        roblox_moderation_raw TEXT,
        roblox_moderation_attempt_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE settings_new (
        id TEXT PRIMARY KEY NOT NULL,
        default_speed REAL NOT NULL,
        default_amplify_db REAL NOT NULL,
        default_target_lufs REAL NOT NULL DEFAULT -14,
        default_quality TEXT NOT NULL CHECK (default_quality IN ('q5', 'q6', 'q7', 'q8')),
        default_audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (default_audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
        default_headroom_db REAL NOT NULL DEFAULT -3,
        default_limiter_enabled INTEGER NOT NULL CHECK (default_limiter_enabled IN (0, 1)),
        default_upload_enabled INTEGER NOT NULL CHECK (default_upload_enabled IN (0, 1)),
        default_credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
        default_asset_name_pattern TEXT NOT NULL,
        cleanup_target TEXT NOT NULL CHECK (cleanup_target IN ('temp', 'outputs', 'all')),
        cleanup_retention TEXT NOT NULL CHECK (cleanup_retention IN ('all', '24h', '7d')),
        max_concurrent_jobs INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE audio_presets_new (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        speed REAL NOT NULL,
        amplify_db REAL NOT NULL,
        target_lufs REAL NOT NULL DEFAULT -14,
        quality TEXT NOT NULL CHECK (quality IN ('q5', 'q6', 'q7', 'q8')),
        audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe' CHECK (audio_safety_mode IN ('roblox_safe', 'high_quality', 'loud', 'custom')),
        headroom_db REAL NOT NULL DEFAULT -3,
        limiter_enabled INTEGER NOT NULL CHECK (limiter_enabled IN (0, 1)),
        upload_enabled INTEGER NOT NULL CHECK (upload_enabled IN (0, 1)),
        credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
        asset_name_pattern TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO batches_new (
        id, name, status, url_count, speed, amplify_db, target_lufs, quality, audio_safety_mode, headroom_db,
        limiter_enabled, upload_enabled, credential_id, credential_name, asset_name_pattern, created_at, updated_at
      )
      SELECT id, name, status, url_count, speed, amplify_db, COALESCE(target_lufs, -14), quality, audio_safety_mode, headroom_db,
        limiter_enabled, upload_enabled, credential_id, credential_name, asset_name_pattern, created_at, updated_at
      FROM batches;

      INSERT INTO jobs_new (
        id, batch_id, source_url, source_platform, title, status, progress, speed, amplify_db, target_lufs, quality,
        audio_safety_mode, headroom_db, limiter_enabled, upload_enabled, credential_id, credential_name,
        asset_name_pattern, source_local_path, trim_group_id, trim_original_url, trim_part_index, trim_part_total,
        trim_start_sec, trim_duration_sec, output_path, output_duration_sec, output_size_bytes, output_peak_db, output_mean_db,
        output_sample_rate, output_channels, attempt_count, max_attempts, asset_id, roblox_operation_id,
        roblox_operation_path, roblox_operation_status, roblox_operation_checked_at, roblox_operation_raw,
        roblox_moderation_state, roblox_moderation_checked_at, roblox_moderation_raw,
        roblox_moderation_attempt_count, error, created_at, updated_at
      )
      SELECT id, batch_id, source_url, source_platform, title, status, progress, speed, amplify_db, COALESCE(target_lufs, -14), quality,
        audio_safety_mode, headroom_db, limiter_enabled, upload_enabled, credential_id, credential_name,
        asset_name_pattern, source_local_path, trim_group_id, trim_original_url, trim_part_index, trim_part_total,
        trim_start_sec, trim_duration_sec, output_path, output_duration_sec, output_size_bytes, output_peak_db, output_mean_db,
        output_sample_rate, output_channels, attempt_count, max_attempts, asset_id, roblox_operation_id,
        roblox_operation_path, roblox_operation_status, roblox_operation_checked_at, roblox_operation_raw,
        roblox_moderation_state, roblox_moderation_checked_at, roblox_moderation_raw,
        roblox_moderation_attempt_count, error, created_at, updated_at
      FROM jobs;

      INSERT INTO settings_new (
        id, default_speed, default_amplify_db, default_target_lufs, default_quality, default_audio_safety_mode, default_headroom_db,
        default_limiter_enabled, default_upload_enabled, default_credential_id, default_asset_name_pattern,
        cleanup_target, cleanup_retention, max_concurrent_jobs, retry_count, created_at, updated_at
      )
      SELECT id, default_speed, default_amplify_db, COALESCE(default_target_lufs, -14), default_quality, default_audio_safety_mode, default_headroom_db,
        default_limiter_enabled, default_upload_enabled, default_credential_id, default_asset_name_pattern,
        cleanup_target, cleanup_retention, max_concurrent_jobs, retry_count, created_at, updated_at
      FROM settings;

      INSERT INTO audio_presets_new (
        id, name, description, speed, amplify_db, target_lufs, quality, audio_safety_mode, headroom_db,
        limiter_enabled, upload_enabled, credential_id, asset_name_pattern, is_default, created_at, updated_at
      )
      SELECT id, name, description, speed, amplify_db, COALESCE(target_lufs, -14), quality, audio_safety_mode, headroom_db,
        limiter_enabled, upload_enabled, credential_id, asset_name_pattern, is_default, created_at, updated_at
      FROM audio_presets;

      DROP TABLE jobs;
      DROP TABLE batches;
      DROP TABLE settings;
      DROP TABLE audio_presets;

      ALTER TABLE batches_new RENAME TO batches;
      ALTER TABLE jobs_new RENAME TO jobs;
      ALTER TABLE settings_new RENAME TO settings;
      ALTER TABLE audio_presets_new RENAME TO audio_presets;

      COMMIT;
    `);
  } catch (error) {
    sqlite.exec("ROLLBACK;");
    throw error;
  } finally {
    sqlite.exec("PRAGMA foreign_keys = ON");
  }

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS batches_created_at_idx ON batches (created_at);
    CREATE INDEX IF NOT EXISTS batches_status_idx ON batches (status);
    CREATE INDEX IF NOT EXISTS jobs_batch_idx ON jobs (batch_id);
    CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
    CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);
    CREATE INDEX IF NOT EXISTS settings_updated_at_idx ON settings (updated_at);
    CREATE INDEX IF NOT EXISTS audio_presets_default_idx ON audio_presets (is_default, updated_at);
    CREATE INDEX IF NOT EXISTS audio_presets_name_idx ON audio_presets (name);
  `);
}

function ensureMigrations(sqlite: SqliteDatabase) {
  ensureWorkerHeartbeatMigrations(sqlite);
  ensureAudioPresetMigrations(sqlite);
  ensureColumn(sqlite, "batches", "audio_safety_mode", "audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe'");
  ensureColumn(sqlite, "batches", "headroom_db", "headroom_db REAL NOT NULL DEFAULT -3");
  ensureColumn(sqlite, "batches", "target_lufs", "target_lufs REAL NOT NULL DEFAULT -14");
  ensureColumn(sqlite, "jobs", "audio_safety_mode", "audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe'");
  ensureColumn(sqlite, "jobs", "headroom_db", "headroom_db REAL NOT NULL DEFAULT -3");
  ensureColumn(sqlite, "jobs", "target_lufs", "target_lufs REAL NOT NULL DEFAULT -14");
  ensureColumn(sqlite, "jobs", "source_local_path", "source_local_path TEXT");
  ensureColumn(sqlite, "jobs", "trim_group_id", "trim_group_id TEXT");
  ensureColumn(sqlite, "jobs", "trim_original_url", "trim_original_url TEXT");
  ensureColumn(sqlite, "jobs", "trim_part_index", "trim_part_index INTEGER");
  ensureColumn(sqlite, "jobs", "trim_part_total", "trim_part_total INTEGER");
  ensureColumn(sqlite, "jobs", "trim_start_sec", "trim_start_sec REAL");
  ensureColumn(sqlite, "jobs", "trim_duration_sec", "trim_duration_sec REAL");
  ensureColumn(sqlite, "jobs", "output_duration_sec", "output_duration_sec REAL");
  ensureColumn(sqlite, "jobs", "output_size_bytes", "output_size_bytes INTEGER");
  ensureColumn(sqlite, "jobs", "output_peak_db", "output_peak_db REAL");
  ensureColumn(sqlite, "jobs", "output_mean_db", "output_mean_db REAL");
  ensureColumn(sqlite, "jobs", "output_sample_rate", "output_sample_rate INTEGER");
  ensureColumn(sqlite, "jobs", "output_channels", "output_channels INTEGER");
  ensureColumn(sqlite, "jobs", "attempt_count", "attempt_count INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "jobs", "max_attempts", "max_attempts INTEGER NOT NULL DEFAULT 1");
  ensureColumn(sqlite, "jobs", "roblox_operation_id", "roblox_operation_id TEXT");
  ensureColumn(sqlite, "jobs", "roblox_operation_path", "roblox_operation_path TEXT");
  ensureColumn(sqlite, "jobs", "roblox_operation_status", "roblox_operation_status TEXT NOT NULL DEFAULT 'none'");
  ensureColumn(sqlite, "jobs", "roblox_operation_checked_at", "roblox_operation_checked_at INTEGER");
  ensureColumn(sqlite, "jobs", "roblox_operation_raw", "roblox_operation_raw TEXT");
  ensureColumn(sqlite, "jobs", "roblox_moderation_state", "roblox_moderation_state TEXT NOT NULL DEFAULT 'none'");
  ensureColumn(sqlite, "jobs", "roblox_moderation_checked_at", "roblox_moderation_checked_at INTEGER");
  ensureColumn(sqlite, "jobs", "roblox_moderation_raw", "roblox_moderation_raw TEXT");
  ensureColumn(sqlite, "jobs", "roblox_moderation_attempt_count", "roblox_moderation_attempt_count INTEGER NOT NULL DEFAULT 0");
  ensureSettingsMigrations(sqlite);
  ensureColumn(sqlite, "settings", "default_audio_safety_mode", "default_audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe'");
  ensureColumn(sqlite, "settings", "default_headroom_db", "default_headroom_db REAL NOT NULL DEFAULT -3");
  ensureColumn(sqlite, "settings", "default_target_lufs", "default_target_lufs REAL NOT NULL DEFAULT -14");
  ensureColumn(sqlite, "audio_presets", "audio_safety_mode", "audio_safety_mode TEXT NOT NULL DEFAULT 'roblox_safe'");
  ensureColumn(sqlite, "audio_presets", "headroom_db", "headroom_db REAL NOT NULL DEFAULT -3");
  ensureColumn(sqlite, "audio_presets", "target_lufs", "target_lufs REAL NOT NULL DEFAULT -14");
  ensureAdvancedAudioTableMigrations(sqlite);
}

function createSqliteConnection() {
  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  ensureMigrations(sqlite);

  return sqlite;
}

export function getSqlite() {
  if (!globalForDb.__pkaudioSqlite) {
    globalForDb.__pkaudioSqlite = createSqliteConnection();
  } else {
    // Next.js dev hot-reload keeps this global connection alive across code edits.
    // Re-run idempotent migrations so newly added columns exist before Drizzle selects them.
    ensureMigrations(globalForDb.__pkaudioSqlite);
  }

  return globalForDb.__pkaudioSqlite;
}

export function getDb() {
  if (!globalForDb.__pkaudioDb) {
    globalForDb.__pkaudioDb = drizzle(getSqlite(), { schema });
  }

  return globalForDb.__pkaudioDb;
}

export function closeDatabaseConnection() {
  if (globalForDb.__pkaudioSqlite) {
    globalForDb.__pkaudioSqlite.close();
  }
  globalForDb.__pkaudioSqlite = undefined;
  globalForDb.__pkaudioDb = undefined;
}

export function getDatabaseInfo() {
  return {
    path: getDatabasePath(),
  };
}
