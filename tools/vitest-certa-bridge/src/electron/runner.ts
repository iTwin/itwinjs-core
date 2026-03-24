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
import type { ElectronTestResults, ElectronTestRunnerOptions, ShardMetrics } from "./types.js";

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
  const suffix = pattern.replace("**/", "").replace("*", ""); // e.g. ".test.js"

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

/** Split files into N roughly-equal shards. */
function shardTestFiles(testDir: string, pattern: string, shardCount: number): string[][] {
  const allFiles = findTestFiles(testDir, pattern);

  const shards: string[][] = Array.from({ length: shardCount }, () => []);
  for (let i = 0; i < allFiles.length; i++) {
    shards[i % shardCount].push(allFiles[i]);
  }

  return shards.filter((s) => s.length > 0);
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
}

interface ShardExecResult {
  exitCode: number;
  durationMs: number;
  peakRssKb: number;
}

/** Spawn a single Electron shard process and wait for it to exit. */
async function spawnShard(options: ShardExecOptions): Promise<ShardExecResult> {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-require-imports

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

  const spawnOptions: SpawnOptions = {
    stdio: ["ignore", "inherit", "inherit"],
    cwd: process.cwd(),
    env,
  };

  const start = Date.now();
  const electronProcess = spawn(command, [getSessionEntryPath()], spawnOptions);

  const poller = options.sampleRss && electronProcess.pid
    ? new RssPoller(electronProcess.pid)
    : undefined;

  return new Promise((resolve) => {
    electronProcess.on("exit", (status) => {
      const durationMs = Date.now() - start;
      const peakRssKb = poller ? poller.stop() : 0;
      resolve({ exitCode: status || 0, durationMs, peakRssKb });
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

  // Load .env into the base env so all shards inherit it
  if (envFile && fs.existsSync(envFile)) {
    try {
      const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
      const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
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

  // Run all shards in parallel
  const results: { shardIndex: number; exitCode: number; durationMs: number; peakRssKb: number; fileCount: number }[] = [];
  const promises = shards.map(async (files, index) => {
    const shardId = `shard-${index}`;
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `electron-test-cache-${shardId}-`));

    // Write shard manifest
    const manifestPath = path.join(cacheDir, "test-manifest.txt");
    fs.writeFileSync(manifestPath, files.join("\n"), "utf8");

    try {
      const result = await spawnShard({
        shardId,
        cacheDir,
        baseEnv,
        grepPattern: effectiveGrep,
        timeout,
        sampleRss: options.benchmarkMode,
      });
      results.push({ shardIndex: index, fileCount: files.length, ...result });
    } catch {
      results.push({ shardIndex: index, exitCode: 1, durationMs: 0, peakRssKb: 0, fileCount: files.length });
    } finally {
      cleanupCacheDir(cacheDir);
    }
  });

  await Promise.all(promises);

  const failedShards = results.filter((r) => r.exitCode !== 0).map((r) => r.shardIndex);
  const passed = results.filter((r) => r.exitCode === 0).length;
  const failed = failedShards.length;

  const metrics: ShardMetrics[] | undefined = options.benchmarkMode
    ? results.map((r) => ({
      shardIndex: r.shardIndex,
      testFileCount: r.fileCount,
      durationMs: r.durationMs,
      peakRssKb: r.peakRssKb,
      exitCode: r.exitCode,
    }))
    : undefined;

  return { passed, failed, shardCount: shards.length, failedShards, metrics };
}
