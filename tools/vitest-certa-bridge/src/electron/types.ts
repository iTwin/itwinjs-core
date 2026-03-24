/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** Options for the Electron test orchestrator. */
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
  /** Invert the grep pattern (exclude matching tests). */
  invertGrep?: boolean;
  /** Absolute path to a .env file to load before spawning Electron processes. */
  envFile?: string;
  /** Per-shard timeout in milliseconds (default: 240000). */
  timeout?: number;
  /** Extra environment variables to pass to each Electron process. */
  env?: Record<string, string>;
}

/** Aggregate results from all Electron shards. */
export interface ElectronTestResults {
  passed: number;
  failed: number;
  shardCount: number;
  failedShards: number[];
}

/** IPC payload sent from renderer to main process with test results. */
export interface RendererTestResults {
  passed: number;
  failed: number;
  errors: string[];
}

/** Options for building the renderer harness script. */
export interface RendererHarnessOptions {
  /** Bridge token for IPC callback authentication. */
  bridgeToken: string;
  /** Absolute path to the setup file (loaded before test files). */
  setupFile: string;
  /** Absolute paths to all test files to run. */
  testFiles: string[];
  /** Regex pattern to filter test names. */
  grepPattern?: string;
}
