#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { loadLocalEnv } from "@/lib/system/env";
import { getLocalDoctorReport, type DoctorCheck } from "@/lib/system/doctor";

loadLocalEnv();

const runFull = process.argv.includes("--full");
const noBuild = process.argv.includes("--no-build");

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};

function log(message: string, color = colors.dim) {
  process.stdout.write(`${color}[qa]${colors.reset} ${message}\n`);
}

function statusIcon(status: DoctorCheck["status"]) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    log(`running ${command} ${args.join(" ")}`.trim(), colors.cyan);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit ${code ?? 1}`}`));
    });
  });
}

async function main() {
  const report = await getLocalDoctorReport();
  log(`doctor generated at ${report.generatedAt}`, colors.cyan);
  for (const item of report.checks) {
    const color = item.status === "pass" ? colors.green : item.status === "warn" ? colors.yellow : colors.red;
    log(`${statusIcon(item.status)} ${item.label}: ${item.detail}`, color);
    if (item.remediation) log(`  fix: ${item.remediation}`, colors.dim);
  }

  log(`summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail (${report.summary.status})`, report.summary.fail ? colors.red : report.summary.warn ? colors.yellow : colors.green);
  if (report.summary.fail > 0) {
    throw new Error("Local doctor has failing checks. Fix FAIL items before running PKAudio.");
  }

  if (!runFull) {
    log("doctor-only QA complete. Use npm run qa:full for typecheck + lint + build.", colors.cyan);
    return;
  }

  await run("npm", ["run", "typecheck"]);
  await run("npm", ["run", "lint"]);
  if (!noBuild) await run("npm", ["run", "build"]);
  log("full QA commands finished.", colors.green);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error), colors.red);
  process.exit(1);
});
