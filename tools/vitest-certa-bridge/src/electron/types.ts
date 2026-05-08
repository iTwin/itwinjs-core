/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { GrepMode } from "../types.js";

/**
 * Options for the Electron test orchestrator.
 * @beta
 */
export interface ElectronTestRunnerOptions {
  /** Absolute path to the backend init module (loaded in each Electron main process). */
  backendInitModule: string;
  /** Absolute path to the Vitest setup file (loaded in renderer before test files). */
  setupFile: string;
  /** Absolute path to the directory containing compiled test files. */
  testDir: string;
  /** Glob pattern for test files within testDir (default: "**\/*.test.js"). */
  testGlob?: string;
  /** Number of parallel Electron shards (default: 4). */
  shardCount?: number;
  /** Regex pattern to filter test names. */
  grepPattern?: string;
  /** Whether to include or exclude tests matching grepPattern (default: "exclude"). */
  grepMode?: GrepMode;
  /** Absolute path to a .env file to load before spawning Electron processes. */
  envFile?: string;
  /** Per-shard timeout in milliseconds (default: 600000). */
  timeout?: number;
  /** Per-test timeout in milliseconds (default: 240000). Passed to renderer harness. */
  testTimeout?: number;
  /** Per-hook (before/after) timeout in milliseconds (default: 240000). Passed to renderer harness. */
  hookTimeout?: number;
  /** Extra environment variables to pass to each Electron process. */
  env?: Record<string, string>;
  /**
   * Regex patterns for bare-specifier `import()` → `require()` rewriting.
   * In Electron's renderer with `nodeIntegration: true`, dynamic `import()` uses
   * Chromium's ESM loader which cannot resolve Node.js bare specifiers or parse CJS.
   * This option rewrites matching `import("pkg/path")` to `Promise.resolve(require("pkg/path"))`
   * via a `Module._extensions` compile hook applied to all loaded test files.
   *
   * Each string is compiled into a RegExp and used inside a `content.replace()` call
   * where capture group `$1` is the full specifier.
   *
   * @example
   * ```ts
   * importRewritePatterns: ["@itwin/core-electron/[^\"']+"]
   * ```
   */
  importRewritePatterns?: string[];
  /**
   * Extra command-line arguments passed to the Electron binary for every shard.
   * Use this to pass platform- or environment-specific flags such as `--disable-gpu`
   * on CI machines that use software renderers (SwiftShader on Linux, WARP on Windows).
   *
   * @example
   * ```ts
   * // Disable GPU compositing on Linux/Windows CI to avoid transient failures
   * const isCI = !!(process.env.CI || process.env.TF_BUILD);
   * electronArgs: isCI && process.platform !== "darwin" ? ["--disable-gpu"] : [],
   * ```
   */
  electronArgs?: string[];
  /**
   * A string of JavaScript code injected into the renderer harness after all test
   * files have been loaded (and `require.cache` is populated) but before suites
   * are executed. Use this to monkey-patch loaded modules, configure globals, or
   * perform any app-specific renderer setup.
   *
   * The code runs in the same scope as the harness and has access to `require`,
   * `require.cache`, `window`, and all Node.js APIs available in the renderer.
   *
   * @example
   * ```ts
   * rendererSetup: `
   *   // Patch a test utility for Electron-specific startup
   *   const mod = Object.keys(require.cache).find(m => m.endsWith("MyUtil.js"));
   *   if (mod) require.cache[mod].exports.MyUtil.init = () => { ... };
   * `
   * ```
   */
  rendererSetup?: string;
}

/**
 * Aggregate results from all Electron shards.
 * @beta
 */
export interface ElectronTestResults {
  passed: number;
  failed: number;
  skipped: number;
  shardCount: number;
  failedShards: number[];
  /** Per-shard details (always populated). */
  shardResults: ShardResult[];
}

/**
 * Per-shard result details.
 * @beta
 */
export interface ShardResult {
  shardIndex: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
  /** Non-fatal warnings (e.g. post-test shutdown crash after all tests passed). */
  warnings: string[];
  durationMs: number;
  fileCount: number;
}

/**
 * IPC payload sent from renderer to main process with test results.
 * @internal
 */
export interface RendererTestResults {
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
  suppressedRejections?: number;
}

/**
 * Options for building the renderer harness script.
 * @internal
 */
export interface RendererHarnessOptions {
  /** Bridge token for IPC callback authentication. */
  bridgeToken: string;
  /** Absolute path to the setup file (loaded before test files). */
  setupFile: string;
  /** Absolute paths to all test files to run. */
  testFiles: string[];
  /** Regex pattern to filter test names. */
  grepPattern?: string;
  /** Per-test timeout in milliseconds (default: 240000). */
  testTimeout?: number;
  /** Per-hook timeout in milliseconds (default: 240000). */
  hookTimeout?: number;
  /**
   * Regex patterns (as strings) for bare-specifier `import()` → `require()` rewriting.
   * Each pattern must contain a capture group for the full module specifier.
   * Example: `["@itwin/core-electron/[^\"']+"]` rewrites
   * `import("@itwin/core-electron/lib/cjs/ElectronFrontend.js")` → `Promise.resolve(require(...))`.
   * If empty or omitted, the Module._extensions compile hook is still installed but performs no rewrites.
   */
  importRewritePatterns?: string[];
  /**
   * Raw JavaScript code injected after test files are loaded but before suite execution.
   * Runs in the renderer scope with access to `require`, `require.cache`, `window`, etc.
   */
  rendererSetup?: string;
}
