#!/usr/bin/env tsx
/**
 * smoke-all.ts — Runs all smoke scripts sequentially.
 * Each smoke script must exit with code 0 on success.
 *
 * Usage:
 *   npx tsx scripts/smoke-all.ts
 *   npm run smoke
 */

import { execSync } from "node:child_process";

const smokeScripts = [
  "smoke-audio-normalization",
  "smoke-roblox-title",
  "smoke-roblox-audio-code-order",
  "smoke-auto-cut-plan",
  "smoke-trim-batch-order",
  "smoke-auto-cut-media",
  "smoke-converted-upload",
  "smoke-latest-queue",
];

const results: { name: string; ok: boolean }[] = [];
let failed = 0;

console.log("\n═══════════════════════════════════");
console.log("  PKAudio Smoke Suite");
console.log("═══════════════════════════════════\n");

for (const script of smokeScripts) {
  process.stdout.write(`  ▶ ${script} ... `);
  try {
    execSync(`npx tsx scripts/${script}.ts`, {
      stdio: "pipe",
      timeout: 60000,
      cwd: process.cwd(),
    });
    console.log("✓ PASS");
    results.push({ name: script, ok: true });
  } catch (error) {
    console.log("✗ FAIL");
    console.error(`    ${(error as Error).message.split("\n")[0]}`);
    results.push({ name: script, ok: false });
    failed++;
  }
}

console.log("\n═══════════════════════════════════");
console.log(`  Results: ${results.length - failed}/${results.length} passed`);
console.log("═══════════════════════════════════\n");

for (const result of results) {
  console.log(`  ${result.ok ? "✓" : "✗"} ${result.name}`);
}

process.exit(failed > 0 ? 1 : 0);
