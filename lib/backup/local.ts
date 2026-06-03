import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { closeDatabaseConnection, getDatabaseInfo, getSqlite } from "@/lib/db/client";
import { getStorageRoots, getDirectoryStats } from "@/lib/storage/local";
import { runCommand } from "@/lib/system/command";
import { getActiveJobIds, getWorkerHealthStatus } from "@/lib/worker/health";

export type BackupMode = "db" | "full";

export type BackupManifest = {
  schemaVersion: 1;
  id: string;
  label: string | null;
  mode: BackupMode;
  createdAt: string;
  app: {
    name: string;
    version: string;
  };
  paths: {
    archiveName: string;
    dbPath: string;
    outputsIncluded: boolean;
  };
  stats: {
    dbBytes: number;
    outputBytes: number;
    outputFiles: number;
    archiveBytes: number;
  };
  security: {
    containsEncryptedRobloxCredentials: boolean;
    envFileIncluded: false;
    requiresSameMasterKey: boolean;
    masterKeySha256Prefix: string | null;
  };
};

export type BackupSummary = BackupManifest & {
  archivePath: string;
  manifestPath: string;
  exists: boolean;
};

export type RestoreResult = {
  restoredBackup: BackupSummary;
  rollbackBackup: BackupSummary;
  restoredDb: boolean;
  restoredOutputs: boolean;
  activeJobIdsChecked: string[];
};

const backupRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "backups");
const stagingRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "tmp", "backups");

function iso(timestamp = Date.now()) {
  return new Date(timestamp).toISOString();
}

function safeId(value: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error("Invalid backup id.");
  return value;
}

function backupPaths(id: string) {
  const safe = safeId(id);
  return {
    archivePath: path.join(backupRoot, `${safe}.tar.gz`),
    manifestPath: path.join(backupRoot, `${safe}.manifest.json`),
  };
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function fileSize(target: string) {
  try {
    const stat = await fs.stat(target);
    return stat.size;
  } catch {
    return 0;
  }
}

function normalizeLabel(label?: string | null) {
  const cleaned = label?.trim().replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 80) ?? "";
  return cleaned || null;
}

function masterKeyPrefix() {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) return null;
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function readPackageInfo() {
  return { name: "pkaudio", version: "0.1.0" };
}

async function copyIfExists(source: string, destination: string) {
  if (!(await pathExists(source))) return false;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  return true;
}

async function copyDirectoryIfExists(source: string, destination: string) {
  if (!(await pathExists(source))) return false;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
  return true;
}

async function checkpointDatabase() {
  try {
    getSqlite().pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // If another process owns the WAL briefly, copying the main DB is still better than failing backup creation.
  }
}

export function getBackupRoot() {
  return backupRoot;
}

export async function createBackup(options: { mode: BackupMode; label?: string | null }): Promise<BackupSummary> {
  await fs.mkdir(backupRoot, { recursive: true });
  await fs.mkdir(stagingRoot, { recursive: true });

  const label = normalizeLabel(options.label);
  const id = `pkaudio-${new Date().toISOString().replace(/[:.]/g, "-")}-${options.mode}-${randomUUID().slice(0, 8)}`;
  const { archivePath, manifestPath } = backupPaths(id);
  const stagePath = path.join(stagingRoot, id);
  await fs.rm(stagePath, { recursive: true, force: true });
  await fs.mkdir(stagePath, { recursive: true });

  const dbPath = getDatabaseInfo().path;
  const roots = getStorageRoots();
  const packageInfo = await readPackageInfo();

  await checkpointDatabase();
  const dbCopied = await copyIfExists(dbPath, path.join(stagePath, "data", "pkaudio.sqlite"));
  if (!dbCopied) throw new Error(`SQLite database was not found: ${dbPath}`);

  const outputStats = await getDirectoryStats(roots.outputs);
  const outputsIncluded = options.mode === "full" && (await copyDirectoryIfExists(roots.outputs, path.join(stagePath, "outputs")));
  const dbBytes = await fileSize(dbPath);

  const manifest: BackupManifest = {
    schemaVersion: 1,
    id,
    label,
    mode: options.mode,
    createdAt: iso(),
    app: packageInfo,
    paths: {
      archiveName: `${id}.tar.gz`,
      dbPath,
      outputsIncluded,
    },
    stats: {
      dbBytes,
      outputBytes: outputsIncluded ? outputStats.bytes : 0,
      outputFiles: outputsIncluded ? outputStats.files : 0,
      archiveBytes: 0,
    },
    security: {
      containsEncryptedRobloxCredentials: true,
      envFileIncluded: false,
      requiresSameMasterKey: true,
      masterKeySha256Prefix: masterKeyPrefix(),
    },
  };

  const archiveEntries = ["backup-manifest.json", "data", ...(outputsIncluded ? ["outputs"] : [])];

  await fs.writeFile(path.join(stagePath, "backup-manifest.json"), JSON.stringify(manifest, null, 2));
  await runCommand("tar", ["-czf", archivePath, "-C", stagePath, ...archiveEntries], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  manifest.stats.archiveBytes = await fileSize(archivePath);
  await fs.writeFile(path.join(stagePath, "backup-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await runCommand("tar", ["-czf", archivePath, "-C", stagePath, ...archiveEntries], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  manifest.stats.archiveBytes = await fileSize(archivePath);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await fs.rm(stagePath, { recursive: true, force: true });

  return { ...manifest, archivePath, manifestPath, exists: true };
}

export async function listBackups(): Promise<BackupSummary[]> {
  await fs.mkdir(backupRoot, { recursive: true });
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const manifests = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".manifest.json"));
  const backups: BackupSummary[] = [];

  for (const entry of manifests) {
    const manifestPath = path.join(backupRoot, entry.name);
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest;
      if (manifest.schemaVersion !== 1 || !manifest.id) continue;
      const { archivePath } = backupPaths(manifest.id);
      const exists = await pathExists(archivePath);
      backups.push({ ...manifest, archivePath, manifestPath, exists });
    } catch {
      // Ignore corrupt sidecars; the archive can still be handled manually from backups/ if needed.
    }
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackup(id: string): Promise<BackupSummary> {
  const safe = safeId(id);
  const { archivePath, manifestPath } = backupPaths(safe);
  if (!(await pathExists(manifestPath))) throw new Error("Backup manifest not found.");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest;
  if (manifest.schemaVersion !== 1 || manifest.id !== safe) throw new Error("Backup manifest is invalid.");
  return { ...manifest, archivePath, manifestPath, exists: await pathExists(archivePath) };
}

export async function deleteBackup(id: string) {
  const backup = await getBackup(id);
  await fs.rm(backup.archivePath, { force: true });
  await fs.rm(backup.manifestPath, { force: true });
  return backup;
}

async function validateExtractedBackup(extractPath: string, expectedId: string) {
  const manifestPath = path.join(extractPath, "backup-manifest.json");
  if (!(await pathExists(manifestPath))) throw new Error("Backup archive is missing backup-manifest.json.");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest;
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported backup manifest schema.");
  if (manifest.id !== expectedId) throw new Error("Backup archive id does not match selected manifest.");
  const dbPath = path.join(extractPath, "data", "pkaudio.sqlite");
  if (!(await pathExists(dbPath))) throw new Error("Backup archive is missing data/pkaudio.sqlite.");
  return { manifest, dbPath, outputsPath: path.join(extractPath, "outputs") };
}

export async function restoreBackup(id: string, options: { restoreOutputs?: boolean } = {}): Promise<RestoreResult> {
  const backup = await getBackup(id);
  if (!backup.exists) throw new Error("Backup archive file is missing.");

  const activeJobIds = await getActiveJobIds();
  if (activeJobIds.length) {
    throw new Error(`Refusing restore while worker has active job(s): ${activeJobIds.join(", ")}`);
  }
  const workerHealth = await getWorkerHealthStatus();
  if (workerHealth.online) {
    throw new Error("Refusing restore while worker is online. Stop npm run worker/pkaudio first, then restore.");
  }

  const rollbackBackup = await createBackup({
    mode: options.restoreOutputs && backup.paths.outputsIncluded ? "full" : "db",
    label: `rollback-before-restore-${backup.id}`,
  });
  const extractPath = path.join(stagingRoot, `restore-${backup.id}-${randomUUID().slice(0, 8)}`);
  await fs.rm(extractPath, { recursive: true, force: true });
  await fs.mkdir(extractPath, { recursive: true });

  try {
    await runCommand("tar", ["-xzf", backup.archivePath, "-C", extractPath], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    const extracted = await validateExtractedBackup(extractPath, backup.id);

    closeDatabaseConnection();
    const dbPath = getDatabaseInfo().path;
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.copyFile(extracted.dbPath, dbPath);
    await fs.rm(`${dbPath}-wal`, { force: true });
    await fs.rm(`${dbPath}-shm`, { force: true });

    let restoredOutputs = false;
    if (options.restoreOutputs && backup.paths.outputsIncluded && fsSync.existsSync(extracted.outputsPath)) {
      const roots = getStorageRoots();
      await fs.mkdir(roots.outputs, { recursive: true });
      await fs.cp(extracted.outputsPath, roots.outputs, { recursive: true, force: true });
      restoredOutputs = true;
    }

    await checkpointDatabase();
    return {
      restoredBackup: backup,
      rollbackBackup,
      restoredDb: true,
      restoredOutputs,
      activeJobIdsChecked: activeJobIds,
    };
  } finally {
    await fs.rm(extractPath, { recursive: true, force: true });
  }
}
