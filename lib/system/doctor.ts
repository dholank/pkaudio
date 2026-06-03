import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { listBackups } from "@/lib/backup/local";
import { getDatabaseInfo, getSqlite } from "@/lib/db/client";
import { getQueueDepthStats, getWorkerHealthStatus } from "@/lib/worker/health";
import { getStorageRoots, getStorageStats } from "@/lib/storage/local";
import { getSystemChecks } from "@/lib/system/checks";
import { loadLocalEnv } from "@/lib/system/env";

export type DoctorStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
  remediation?: string;
};

export type DoctorReport = {
  generatedAt: string;
  cwd: string;
  platform: NodeJS.Platform;
  isWsl: boolean;
  summary: {
    status: "ready" | "needs_attention" | "blocked";
    pass: number;
    warn: number;
    fail: number;
  };
  checks: DoctorCheck[];
  commands: {
    runAll: string;
    startApp: string;
    worker: string;
    workerOnce: string;
    backup: string;
  };
};

function check(id: string, label: string, status: DoctorStatus, detail: string, remediation?: string): DoctorCheck {
  return { id, label, status, detail, remediation };
}

function isUnderWindowsMount(target: string) {
  return path.resolve(target).startsWith("/mnt/");
}

function detectWsl() {
  if (Boolean(process.env.WSL_DISTRO_NAME)) return true;
  try {
    const version = fsSync.readFileSync("/proc/version", "utf8").toLowerCase();
    return version.includes("microsoft") || version.includes("wsl");
  } catch {
    return false;
  }
}

function validateMasterKey() {
  const raw = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!raw) {
    return check(
      "encryption-master-key",
      "Encryption master key",
      "fail",
      "ENCRYPTION_MASTER_KEY is missing.",
      "Create .env.local with ENCRYPTION_MASTER_KEY=$(openssl rand -base64 32).",
    );
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    return check(
      "encryption-master-key",
      "Encryption master key",
      "fail",
      `ENCRYPTION_MASTER_KEY decodes to ${decoded.length} bytes, expected exactly 32 bytes.`,
      "Regenerate with: openssl rand -base64 32, then re-save credentials if old encrypted keys cannot decrypt.",
    );
  }

  return check("encryption-master-key", "Encryption master key", "pass", "ENCRYPTION_MASTER_KEY is configured and decodes to 32 bytes.");
}

async function ensureDirectoryWritable(root: string, label: string, id: string) {
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.access(root, fsSync.constants.R_OK | fsSync.constants.W_OK);
    return check(id, label, "pass", `${root} is readable and writable.`);
  } catch (error) {
    return check(id, label, "fail", `${root} is not writable: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function summarize(checks: DoctorCheck[]): DoctorReport["summary"] {
  const pass = checks.filter((item) => item.status === "pass").length;
  const warn = checks.filter((item) => item.status === "warn").length;
  const fail = checks.filter((item) => item.status === "fail").length;
  return {
    status: fail > 0 ? "blocked" : warn > 0 ? "needs_attention" : "ready",
    pass,
    warn,
    fail,
  };
}

export async function getLocalDoctorReport(): Promise<DoctorReport> {
  loadLocalEnv();

  const checks: DoctorCheck[] = [];
  const cwd = process.cwd();
  const wsl = detectWsl();
  const envPath = path.join(/* turbopackIgnore: true */ cwd, ".env.local");
  const dbPath = getDatabaseInfo().path;
  const roots = getStorageRoots();

  checks.push(
    check(
      "runtime-filesystem",
      "WSL2 filesystem location",
      isUnderWindowsMount(cwd) ? "fail" : "pass",
      wsl ? `Running inside WSL at ${cwd}.` : `Running on ${process.platform} at ${cwd}.`,
      isUnderWindowsMount(cwd) ? "Move the project to ~/workspace/pkaudio instead of /mnt/c for SQLite/media performance." : undefined,
    ),
  );

  checks.push(
    fsSync.existsSync(envPath)
      ? check("env-file", ".env.local", "pass", ".env.local exists. It is not included in backups or git.")
      : check("env-file", ".env.local", "warn", ".env.local was not found; scripts and saved credentials may fail.", "Create .env.local from README instructions."),
  );

  checks.push(validateMasterKey());

  try {
    const sqlite = getSqlite();
    const quickCheck = sqlite.pragma("quick_check") as Array<Record<string, string>>;
    const quickCheckValue = Object.values(quickCheck[0] ?? {})[0] ?? "unknown";
    checks.push(check("sqlite-connection", "SQLite connection", "pass", `Connected to ${dbPath}.`));
    checks.push(
      check(
        "sqlite-integrity",
        "SQLite quick_check",
        quickCheckValue === "ok" ? "pass" : "fail",
        `PRAGMA quick_check returned: ${quickCheckValue}.`,
        quickCheckValue === "ok" ? undefined : "Restore from a known-good backup or inspect data/pkaudio.sqlite manually.",
      ),
    );
    checks.push(
      check(
        "sqlite-filesystem",
        "SQLite filesystem location",
        isUnderWindowsMount(dbPath) ? "fail" : "pass",
        dbPath,
        isUnderWindowsMount(dbPath) ? "Set PKAUDIO_DB_PATH to ./data/pkaudio.sqlite under the Linux project directory." : undefined,
      ),
    );
  } catch (error) {
    checks.push(
      check(
        "sqlite-connection",
        "SQLite connection",
        "fail",
        error instanceof Error ? error.message : "Database connection failed.",
        "Verify PKAUDIO_DB_PATH and directory permissions.",
      ),
    );
  }

  const binaries = await getSystemChecks();
  for (const binary of Object.values(binaries)) {
    checks.push(
      check(
        `binary-${binary.command}`,
        `${binary.command} binary`,
        binary.ok ? "pass" : "fail",
        binary.ok ? `${binary.path} • ${binary.version ?? "version unavailable"}` : binary.error ?? `${binary.command} not found.`,
        binary.ok ? undefined : binary.command === "yt-dlp" ? "Install/update with: python3 -m pip install --user -U yt-dlp --break-system-packages" : "Install with: sudo apt install ffmpeg",
      ),
    );
  }

  checks.push(await ensureDirectoryWritable(roots.outputs, "Output directory", "outputs-directory"));
  checks.push(await ensureDirectoryWritable(roots.temp, "Temp jobs directory", "temp-directory"));
  checks.push(await ensureDirectoryWritable(path.join(/* turbopackIgnore: true */ cwd, "backups"), "Backup directory", "backup-directory"));

  try {
    const storage = await getStorageStats();
    checks.push(check("storage-stats", "Storage stats", "pass", `outputs=${storage.outputs.files} file(s), tmp=${storage.temp.files} file(s).`));
  } catch (error) {
    checks.push(check("storage-stats", "Storage stats", "warn", error instanceof Error ? error.message : "Could not read storage stats."));
  }

  try {
    const backups = await listBackups();
    checks.push(
      backups.length > 0
        ? check("local-backups", "Local backups", "pass", `${backups.length} backup(s) available in backups/.`)
        : check("local-backups", "Local backups", "warn", "No local backup exists yet.", "Create a DB backup from Settings before risky cleanup or restore tests."),
    );
  } catch (error) {
    checks.push(check("local-backups", "Local backups", "warn", error instanceof Error ? error.message : "Could not list local backups."));
  }

  try {
    const [workerHealth, queueDepth] = await Promise.all([getWorkerHealthStatus(), getQueueDepthStats()]);
    checks.push(
      workerHealth.online
        ? check("worker-health", "Worker heartbeat", "pass", `${workerHealth.summary.onlineWorkers} online worker(s), active jobs=${workerHealth.summary.activeJobCount}.`)
        : check("worker-health", "Worker heartbeat", "warn", "No online worker heartbeat right now.", "Start processing with npm run worker or npm run pkaudio."),
    );
    checks.push(
      queueDepth.active > 0
        ? check("active-jobs", "Active jobs", "warn", `${queueDepth.active} active job(s); avoid restore/cleanup until finished.`)
        : check("active-jobs", "Active jobs", "pass", `No active jobs. queued=${queueDepth.queued}, converted=${queueDepth.converted}, done=${queueDepth.done}, failed=${queueDepth.failed}.`),
    );
  } catch (error) {
    checks.push(check("worker-health", "Worker heartbeat", "warn", error instanceof Error ? error.message : "Could not read worker health."));
  }

  return {
    generatedAt: new Date().toISOString(),
    cwd,
    platform: process.platform,
    isWsl: wsl,
    summary: summarize(checks),
    checks,
    commands: {
      runAll: "npm run qa",
      startApp: "npm run pkaudio",
      worker: "npm run worker",
      workerOnce: "npm run worker:once",
      backup: "Settings → Backup & Restore → Create backup",
    },
  };
}
