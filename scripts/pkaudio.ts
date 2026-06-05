#!/usr/bin/env tsx

import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import { loadLocalEnv } from "@/lib/system/env";
import { getSystemChecks } from "@/lib/system/checks";

loadLocalEnv();

type ManagedProcess = {
  name: string;
  color: string;
  child: ChildProcess;
  exited: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const managed: ManagedProcess[] = [];
let shuttingDown = false;

function log(message: string, color = colors.dim) {
  process.stdout.write(`${color}[pkaudio]${colors.reset} ${message}\n`);
}

function prefixStream(proc: ManagedProcess, stream: NodeJS.ReadableStream) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    process.stdout.write(`${proc.color}[${proc.name}]${colors.reset} ${line}\n`);
  });
}

function spawnManaged(name: string, color: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  const proc: ManagedProcess = { name, color, child, exited: false, exitCode: null, signal: null };
  managed.push(proc);
  if (child.stdout) prefixStream(proc, child.stdout);
  if (child.stderr) prefixStream(proc, child.stderr);

  child.on("exit", (code, signal) => {
    proc.exited = true;
    proc.exitCode = code;
    proc.signal = signal;
    const reason = signal ? `signal ${signal}` : `exit ${code ?? 0}`;
    log(`${name} stopped (${reason}).`, code === 0 || shuttingDown ? colors.dim : colors.red);

    if (!shuttingDown && code !== 0) {
      shutdown(code ?? 1);
    }
  });

  child.on("error", (error) => {
    log(`${name} failed to start: ${error.message}`, colors.red);
    if (!shuttingDown) shutdown(1);
  });

  return proc;
}

async function assertSystemReady() {
  log("checking required local binaries...", colors.cyan);
  const checks = await getSystemChecks();
  const missing = Object.values(checks).filter((check) => !check.ok);

  for (const check of Object.values(checks)) {
    if (check.ok) {
      log(`${check.command}: ${check.path} (${check.version ?? "version unknown"})`, colors.green);
    } else {
      log(`${check.command}: ${check.error}`, colors.red);
    }
  }

  if (missing.length) {
    throw new Error("Missing required binaries. Install ffmpeg, ffprobe, and yt-dlp before starting PKAudio.");
  }

  if (!process.env.ENCRYPTION_MASTER_KEY) {
    log("warning: ENCRYPTION_MASTER_KEY is not set in .env.local; credential encryption may fail.", colors.yellow);
  }
}

function killProcess(proc: ManagedProcess) {
  if (proc.exited) return;
  try {
    proc.child.kill("SIGTERM");
  } catch {
    // ignore; process may have already exited
  }
}

function forceKillAfterTimeout() {
  setTimeout(() => {
    for (const proc of managed) {
      if (!proc.exited) {
        log(`force killing ${proc.name}...`, colors.yellow);
        try {
          proc.child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }
  }, 5000).unref();
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutting down web server and worker...", colors.yellow);
  for (const proc of managed) killProcess(proc);
  forceKillAfterTimeout();

  const wait = setInterval(() => {
    if (managed.every((proc) => proc.exited)) {
      clearInterval(wait);
      process.exit(exitCode);
    }
  }, 100);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
process.once("SIGHUP", () => shutdown(0));

async function main() {
  await assertSystemReady();
  log("starting PKAudio web dashboard + local media worker...", colors.cyan);
  log("open http://localhost:3000 after Next.js prints ready.", colors.cyan);
  log("press Ctrl+C once to stop both processes cleanly.", colors.dim);

  spawnManaged("web", colors.cyan, npmCommand, ["run", "start"]);
  spawnManaged("worker", colors.magenta, npmCommand, ["run", "worker"]);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error), colors.red);
  process.exit(1);
});
