/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Electron test orchestrator: discovers test files, splits into shards,
// spawns parallel Electron processes, and collects aggregate results.
//
// Each shard is a fully isolated Electron process with its own:
//   - Electron main process (ElectronHost, IModelHost singletons)
//   - BrowserWindow renderer (IModelApp singleton)
//   - IPC channels (Electron IPC is per-process)
//   - Cache directory (via ELECTRON_CACHE_DIR env var)
//
// This works because the Electron backend runs IN-PROCESS (main process),
// not as a shared server. No port conflicts, no shared singletons.

import { spawn, type SpawnOptions } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { RssPoller } from "./rss.js";
import type { ElectronTestResults, ElectronTestRunnerOptions, ShardResult } from "./types.js";

const DEFAULT_SHARD_COUNT = 4;

/** Resolve the session entry point (compiled JS in this package).
 *  Always returns the CJS build path: Electron's main process runs under CJS
 *  (no "type":"module" in the package), so session.js must be CommonJS regardless
 *  of whether runner.js was loaded from lib/cjs or lib/esm.
 */
function getSessionEntryPath(): string {
  // __dirname is either lib/cjs/electron or lib/esm/electron.
  // Three levels up reaches the package root; then we pin to lib/cjs.
  const pkgRoot = path.resolve(__dirname, "../../..");
  return path.join(pkgRoot, "lib", "cjs", "electron", "session.js");
}

/** Discover test files matching a glob-like pattern in testDir. */
function findTestFiles(testDir: string, pattern: string): string[] {
  // Support simple glob patterns: "**/*.test.js" → recursive search for .test.js files
  const isRecursive = pattern.includes("**");
  const ext = path.extname(pattern); // e.g. ".js"
  const suffix = pattern.replaceAll("**/", "").replaceAll("*", ""); // e.g. ".test.js"

  const results: string[] = [];
  const entries = fs.readdirSync(testDir, { recursive: isRecursive, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile())
      continue;
    const name = entry.name;
    if (suffix && !name.endsWith(suffix))
      continue;
    if (ext && !suffix && !name.endsWith(ext))
      continue;
    // Build relative path from testDir
    const parentPath = (entry as any).parentPath ?? (entry as any).path ?? testDir;
    const relPath = path.relative(testDir, path.join(parentPath, name));
    results.push(relPath);
  }
  results.sort();
  return results;
}

/** Count test declarations in a compiled JS file as a rough test-weight proxy. */
function estimateTestCount(filePath: string): number {
  try {
    const src = fs.readFileSync(filePath, "utf8");
    // Match both source patterns:
    //   bare:     it("...", ...)        — source TS or ESM output
    //   compiled: (0, vitest_1.it)(...) — CJS output from tsc
    const matches = src.match(/\bit\s*\(|\.it\)\s*\(/g);
    return matches ? matches.length : 1; // at least 1 so every file gets a weight
  } catch {
    return 1;
  }
}

/** Split files into N shards balanced by estimated test count (greedy bin-packing). */
function shardTestFiles(testDir: string, pattern: string, shardCount: number): string[][] {
  const allFiles = findTestFiles(testDir, pattern);

  // Weigh each file by its estimated test count
  const weighted = allFiles.map((f) => ({
    file: f,
    weight: estimateTestCount(path.join(testDir, f)),
  }));

  // Sort heaviest-first for better bin-packing
  weighted.sort((a, b) => b.weight - a.weight);

  // Greedy assignment: always add next file to the lightest shard
  const shards: { files: string[]; totalWeight: number }[] =
    Array.from({ length: shardCount }, () => ({ files: [], totalWeight: 0 }));

  for (const { file, weight } of weighted) {
    // Find shard with smallest total weight
    let lightest = shards[0];
    for (let i = 1; i < shards.length; i++) {
      if (shards[i].totalWeight < lightest.totalWeight)
        lightest = shards[i];
    }
    lightest.files.push(file);
    lightest.totalWeight += weight;
  }

  return shards.map((s) => s.files).filter((s) => s.length > 0);
}

/** Clean up a temp cache directory, ignoring errors. */
function cleanupCacheDir(cacheDir: string) {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — orphaned dirs are handled by `rush clean`
  }
}

interface ShardExecOptions {
  shardId: string;
  cacheDir: string;
  baseEnv: Record<string, string>;
  grepPattern?: string;
  timeout?: number;
  sampleRss?: boolean;
  /** Extra command-line args passed to the Electron binary (e.g. `--disable-gpu` on crash retry). */
  extraElectronArgs?: string[];
}

interface ShardExecResult {
  exitCode: number;
  durationMs: number;
  peakRssKb: number;
  /** Last test suite/test name seen in stdout before exit (useful for crash diagnostics). */
  lastTestLine: string;
}

/** Spawn a single Electron shard process and wait for it to exit. */
async function spawnShard(options: ShardExecOptions): Promise<ShardExecResult> {
  const command = require("electron/index.js");  

  const env: Record<string, string> = {
    ...options.baseEnv,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ELECTRON_SHARD_ID: options.shardId,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ELECTRON_CACHE_DIR: options.cacheDir,
  };

  if (options.grepPattern)
    env.ELECTRON_TEST_GREP = options.grepPattern;

  if (options.timeout)
    env.ELECTRON_SESSION_TIMEOUT = String(options.timeout);

  // Use pipe for stdout/stderr so we can capture the last test line for crash diagnostics
  // while still forwarding output to the parent console in real-time.
  const spawnOptions: SpawnOptions = {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(),
    env,
  };

  const start = Date.now();
  const electronArgs = [...(options.extraElectronArgs ?? []), getSessionEntryPath()];
  const electronProcess = spawn(command, electronArgs, spawnOptions);

  const poller = options.sampleRss && electronProcess.pid
    ? new RssPoller(electronProcess.pid)
    : undefined;

  // Track the last test-related output line for crash diagnostics.
  // Matches lines like: "  ✓ test name", "  ✗ test name", "  [before all] Suite Name"
  let lastTestLine = "";
  let stdoutRemainder = "";

  electronProcess.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    const text = stdoutRemainder + chunk.toString();
    const lines = text.split("\n");
    stdoutRemainder = lines.pop() ?? ""; // save incomplete line for next chunk
    for (const line of lines) {
      const trimmed = line.replace(/^\[shard-\d+\]\s*/, "").trim();
      if (trimmed.startsWith("✓ ") || trimmed.startsWith("✗ ") || trimmed.startsWith("[before all]"))
        lastTestLine = trimmed;
    }
  });

  electronProcess.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  return new Promise((resolve) => {
    electronProcess.on("exit", (status) => {
      const durationMs = Date.now() - start;
      const peakRssKb = poller ? poller.stop() : 0;
      resolve({ exitCode: status || 0, durationMs, peakRssKb, lastTestLine });
    });

    // Catch spawn failures (e.g. Electron binary not found, permission errors)
    // so we don't hang waiting for an exit event that never fires.
    electronProcess.on("error", (err) => {
      console.error(`Failed to spawn Electron shard: ${err.message}`);
      const durationMs = Date.now() - start;
      const peakRssKb = poller ? poller.stop() : 0;
      resolve({ exitCode: 1, durationMs, peakRssKb, lastTestLine });
    });
  });
}

/**
 * Runs Electron renderer tests with automatic sharding and parallel execution.
 *
 * @example
 * ```ts
 * import { runElectronTests } from "@itwin/vitest-certa-bridge/electron";
 *
 * const results = await runElectronTests({
 *   backendInitModule: path.resolve(__dirname, "../backend/backend"),
 *   setupFile: path.resolve(__dirname, "../frontend/vitest.setup.js"),
 *   testDir: path.resolve(__dirname, "../frontend"),
 *   envFile: path.resolve(__dirname, "../../.env"),
 * });
 * ```
 */
export async function runElectronTests(options: ElectronTestRunnerOptions): Promise<ElectronTestResults> {
  const {
    backendInitModule,
    setupFile,
    testDir,
    testGlob = "**/*.test.js",
    shardCount = DEFAULT_SHARD_COUNT,
    grepPattern,
    invertGrep = false,
    envFile,
    timeout,
    testTimeout,
    hookTimeout,
    importRewritePatterns,
    rendererSetup,
    electronArgs,
    env: extraEnv,
  } = options;

  // Build base env for all spawned Electron processes
  const baseEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...extraEnv,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CERTA_BRIDGE_BACKEND_INIT: backendInitModule,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CERTA_BRIDGE_SETUP_FILE: setupFile,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CERTA_BRIDGE_TEST_DIR: testDir,
  };

  // Pass configurable timeouts to shard processes
  if (testTimeout !== undefined)
    baseEnv.ELECTRON_TEST_TIMEOUT = String(testTimeout);  
  if (hookTimeout !== undefined)
    baseEnv.ELECTRON_HOOK_TIMEOUT = String(hookTimeout);  

  // Pass import rewrite patterns as JSON array for session to deserialize
  if (importRewritePatterns?.length)
    baseEnv.ELECTRON_IMPORT_REWRITE_PATTERNS = JSON.stringify(importRewritePatterns);  

  // Pass renderer setup JS as a base64-encoded string to avoid shell quoting issues
  if (rendererSetup)
    baseEnv.ELECTRON_RENDERER_SETUP = Buffer.from(rendererSetup, "utf8").toString("base64");  

  // Load .env into the base env so all shards inherit it
  if (envFile && fs.existsSync(envFile)) {
    try {
      const dotenv = require("dotenv");  
      const dotenvExpand = require("dotenv-expand");  
      const envResult = dotenv.config({ path: envFile });
      if (!envResult.error)
        dotenvExpand(envResult);
      Object.assign(baseEnv, envResult.parsed ?? {});
    } catch {
      console.warn(`Warning: dotenv not available — cannot load ${envFile}. Install dotenv as a dependency.`);
    }
  }

  // Compute effective grep pattern
  let effectiveGrep: string | undefined;
  if (grepPattern) {
    effectiveGrep = invertGrep ? `^((?!${grepPattern}).)*$` : grepPattern;
  }

  // Discover and shard test files
  const shards = shardTestFiles(testDir, testGlob, shardCount);
  if (shards.length === 0)
    throw new Error(`No test files found in ${testDir} matching ${testGlob}`);

  const totalFiles = shards.reduce((n, s) => n + s.length, 0);
  console.log(`Running ${totalFiles} test files across ${shards.length} Electron shards`);

  // Run all shards in parallel, with automatic retries for crashed shards
  // (native crashes produce no test-results.json, distinguishing them from test failures).
  const results: { shardIndex: number; exitCode: number; durationMs: number; peakRssKb: number; fileCount: number; cacheDir: string; lastTestLine: string; files: string[] }[] = [];

  async function runShard(files: string[], index: number, extraElectronArgs?: string[]): Promise<typeof results[0]> {
    const shardId = `shard-${index}`;
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `electron-test-cache-${shardId}-`));
    const manifestPath = path.join(cacheDir, "test-manifest.txt");
    fs.writeFileSync(manifestPath, files.join("\n"), "utf8");

    try {
      const result = await spawnShard({
        shardId,
        cacheDir,
        baseEnv,
        grepPattern: effectiveGrep,
        timeout,
        sampleRss: false,
        extraElectronArgs,
      });
      return { shardIndex: index, fileCount: files.length, cacheDir, files, ...result };
    } catch {
      return { shardIndex: index, exitCode: 1, durationMs: 0, peakRssKb: 0, fileCount: files.length, cacheDir, lastTestLine: "", files };
    }
  }

  const promises = shards.map(async (files, index) => {
    let result = await runShard(files, index, electronArgs);

    // Retry up to twice if the shard produced no test results at all. This covers:
    // - Crashed shards (non-zero exit, e.g. native exception or OOM)
    // - Silent exits (exit 0 but 0 results, e.g. GPU process init failure)
    // - Transient Electron startup failures (exit 0, no results even after first retry)
    // Real test failures always produce 1+ results and are never retried.
    for (let retry = 0; retry < 2; retry++) {
      const resultsPath = path.join(result.cacheDir, "test-results.json");
      if (fs.existsSync(resultsPath))
        break;
      const reason = result.exitCode !== 0
        ? `crashed (exit ${result.exitCode} / 0x${(result.exitCode >>> 0).toString(16).toUpperCase()})`
        : `exited cleanly but produced no test results`;
      const lastTest = result.lastTestLine ? ` | last test: ${result.lastTestLine}` : "";
      console.warn(`shard-${index} ${reason}${lastTest} — retrying (attempt ${retry + 2})`);
      // Brief delay to let the OS reclaim resources from the crashed process
      await new Promise((resolve) => setTimeout(resolve, 2000));
      cleanupCacheDir(result.cacheDir);
      // Preserve original electronArgs and add --disable-gpu as a crash-recovery measure
      const retryArgs = [...(electronArgs ?? [])];
      if (!retryArgs.includes("--disable-gpu"))
        retryArgs.push("--disable-gpu");
      result = await runShard(files, index, retryArgs);
    }

    results.push(result);
  });

  await Promise.all(promises);

  // Read per-shard structured results (written by session.ts)
  const shardResults: ShardResult[] = results.map((r) => {
    const resultsPath = path.join(r.cacheDir, "test-results.json");
    let testResults = { passed: 0, failed: 0, skipped: 0, errors: [] as string[] };
    try {
      if (fs.existsSync(resultsPath))
        testResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    } catch {
      // Fall back to exit-code-only
    }
    // Detect two failure modes that would otherwise slip through as "OK":
    // 1. Non-zero exit code with no recorded failures (crash before results written)
    // 2. Zero results despite having assigned files (timeout killed shard silently)
    const isUnreportedCrash = r.exitCode !== 0 && testResults.failed === 0 && testResults.errors.length === 0;
    const isSilentTimeout = r.exitCode === 0 && testResults.passed === 0 && testResults.failed === 0 && r.files.length > 0;
    if (isUnreportedCrash || isSilentTimeout) {
      testResults.failed = 1;
      const lines: string[] = [];
      if (isUnreportedCrash) {
        const exitHex = `0x${(r.exitCode >>> 0).toString(16).toUpperCase()}`;
        lines.push(`shard-${r.shardIndex} crashed with exit code ${r.exitCode} (${exitHex})`);
      } else {
        lines.push(`shard-${r.shardIndex} produced 0 passed, 0 failed for ${r.files.length} files — likely timed out`);
      }
      if (r.lastTestLine)
        lines.push(`  Last test output: ${r.lastTestLine}`);
      lines.push(`  Files in this shard: ${r.files.join(", ")}`);
      testResults.errors.push(lines.join("\n"));
    }
    return {
      shardIndex: r.shardIndex,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped || 0,
      errors: testResults.errors,
      durationMs: r.durationMs,
      fileCount: r.fileCount,
    };
  });

  // Clean up cache dirs after reading results
  for (const r of results)
    cleanupCacheDir(r.cacheDir);

  // Print consolidated summary
  const totalPassed = shardResults.reduce((n, s) => n + s.passed, 0);
  const totalFailed = shardResults.reduce((n, s) => n + s.failed, 0);
  const totalSkipped = shardResults.reduce((n, s) => n + s.skipped, 0);
  const maxDuration = Math.max(...shardResults.map((s) => s.durationMs));
  const failedShards = shardResults.filter((s) => s.failed > 0 || results.find((r) => r.shardIndex === s.shardIndex)?.exitCode !== 0).map((s) => s.shardIndex);

  console.log(`\n${"═".repeat(70)}`);
  const skippedSuffix = totalSkipped > 0 ? `, ${totalSkipped} skipped` : "";
  console.log(`Electron Test Summary: ${totalPassed} passed, ${totalFailed} failed${skippedSuffix} (${(maxDuration / 1000).toFixed(1)}s wall-clock)`);
  console.log(`${"─".repeat(70)}`);
  for (const sr of shardResults) {
    const status = sr.failed > 0 ? "FAIL" : " OK ";
    const dur = `${(sr.durationMs / 1000).toFixed(1)}s`;
    const skipped = sr.skipped > 0 ? `, ${sr.skipped} skipped` : "";
    console.log(`  [${status}] shard-${sr.shardIndex}: ${sr.passed} passed, ${sr.failed} failed${skipped} (${sr.fileCount} files, ${dur})`);
  }
  if (totalFailed > 0) {
    console.log(`${"─".repeat(70)}`);
    console.log("Failures:");
    for (const sr of shardResults) {
      for (const err of sr.errors) {
        console.error(`  shard-${sr.shardIndex} ✗ ${err}`);
      }
    }
  }
  console.log(`${"═".repeat(70)}\n`);

  return { passed: totalPassed, failed: totalFailed, skipped: totalSkipped, shardCount: shards.length, failedShards, shardResults };
}
