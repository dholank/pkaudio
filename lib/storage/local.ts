import fs from "node:fs/promises";
import path from "node:path";

export type DirectoryStats = {
  root: string;
  exists: boolean;
  bytes: number;
  files: number;
  dirs: number;
};

export type CleanupResult = {
  target: "temp" | "outputs" | "all";
  deletedBytes: number;
  deletedFiles: number;
  deletedDirs: number;
  skipped: number;
};

export type JobArtifactCleanupResult = {
  outputDeleted: boolean;
  tempDeleted: boolean;
  outputPath: string | null;
  tempPath: string;
  errors: string[];
};

const outputRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "outputs");
const tempRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "tmp", "jobs");

function insideRoot(root: string, target: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function assertInsideRoot(root: string, target: string) {
  if (!insideRoot(root, target)) {
    throw new Error(`Refusing to access path outside storage root: ${target}`);
  }
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function statsForPath(target: string): Promise<Omit<DirectoryStats, "root" | "exists">> {
  let bytes = 0;
  let files = 0;
  let dirs = 0;

  async function walk(current: string) {
    const stat = await fs.stat(current);
    if (stat.isFile()) {
      bytes += stat.size;
      files += 1;
      return;
    }

    if (!stat.isDirectory()) return;
    dirs += 1;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      await walk(path.join(current, entry.name));
    }
  }

  await walk(target);
  return { bytes, files, dirs };
}

export function getStorageRoots() {
  return {
    outputs: outputRoot,
    temp: tempRoot,
  };
}

export async function getDirectoryStats(root: string): Promise<DirectoryStats> {
  const exists = await pathExists(root);
  if (!exists) return { root, exists: false, bytes: 0, files: 0, dirs: 0 };

  const stats = await statsForPath(root);
  return { root, exists: true, ...stats };
}

export async function getStorageStats() {
  const [outputs, temp] = await Promise.all([getDirectoryStats(outputRoot), getDirectoryStats(tempRoot)]);
  return { outputs, temp };
}

function resolveOutputPath(outputPath: string | null | undefined) {
  if (!outputPath) return null;

  const stripped = outputPath.replace(/^outputs[\\/]/, "");
  const target = path.isAbsolute(outputPath) ? outputPath : path.join(outputRoot, stripped);
  assertInsideRoot(outputRoot, target);
  return path.resolve(target);
}

function resolveTempPath(jobId: string) {
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeJobId || safeJobId !== jobId) {
    throw new Error(`Unsafe job id for temp cleanup: ${jobId}`);
  }

  const target = path.join(tempRoot, safeJobId);
  assertInsideRoot(tempRoot, target);
  return target;
}

async function removePath(target: string) {
  if (!(await pathExists(target))) return { deleted: false, bytes: 0, files: 0, dirs: 0 };
  const stats = await statsForPath(target);
  await fs.rm(target, { recursive: true, force: true });
  return { deleted: true, ...stats };
}

async function removeOutputWithSidecars(outputPath: string) {
  const removed = await removePath(outputPath);
  const waveformPath = `${outputPath}.waveform.json`;
  if (insideRoot(outputRoot, waveformPath)) await removePath(waveformPath);
  return removed;
}

async function cleanupChildren(root: string, maxAgeMs: number | null | undefined) {
  const result = { deletedBytes: 0, deletedFiles: 0, deletedDirs: 0, skipped: 0 };
  await fs.mkdir(root, { recursive: true });

  const entries = await fs.readdir(root, { withFileTypes: true });
  const now = Date.now();

  for (const entry of entries) {
    const target = path.join(root, entry.name);
    assertInsideRoot(root, target);

    const stat = await fs.stat(target);
    if (maxAgeMs && maxAgeMs > 0 && now - stat.mtimeMs < maxAgeMs) {
      result.skipped += 1;
      continue;
    }

    const removed = await removePath(target);
    result.deletedBytes += removed.bytes;
    result.deletedFiles += removed.files;
    result.deletedDirs += removed.dirs;
  }

  return result;
}

export async function cleanupStorage(options: { target: "temp" | "outputs" | "all"; maxAgeMs?: number | null }): Promise<CleanupResult> {
  const targets = options.target === "all" ? ["temp", "outputs"] : [options.target];
  const aggregate: CleanupResult = {
    target: options.target,
    deletedBytes: 0,
    deletedFiles: 0,
    deletedDirs: 0,
    skipped: 0,
  };

  for (const target of targets) {
    const root = target === "temp" ? tempRoot : outputRoot;
    const partial = await cleanupChildren(root, options.maxAgeMs);
    aggregate.deletedBytes += partial.deletedBytes;
    aggregate.deletedFiles += partial.deletedFiles;
    aggregate.deletedDirs += partial.deletedDirs;
    aggregate.skipped += partial.skipped;
  }

  return aggregate;
}

export async function deleteJobArtifacts(
  job: { id: string; outputPath: string | null },
  options: { deleteOutput?: boolean; deleteTemp?: boolean } = {},
): Promise<JobArtifactCleanupResult> {
  const errors: string[] = [];
  const outputPath = resolveOutputPath(job.outputPath);
  const tempPath = resolveTempPath(job.id);
  let outputDeleted = false;
  let tempDeleted = false;

  if (options.deleteOutput ?? true) {
    try {
      if (outputPath) outputDeleted = (await removeOutputWithSidecars(outputPath)).deleted;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Failed to delete output file.");
    }
  }

  if (options.deleteTemp ?? true) {
    try {
      tempDeleted = (await removePath(tempPath)).deleted;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Failed to delete temp folder.");
    }
  }

  return { outputDeleted, tempDeleted, outputPath, tempPath, errors };
}
