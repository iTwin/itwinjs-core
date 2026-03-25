/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Generic Electron main process entry point for running Vitest tests in a BrowserWindow.
// Configured entirely via environment variables — no consumer-specific code.
//
// Env vars:
//   CERTA_BRIDGE_BACKEND_INIT — absolute path to backend init module
//   CERTA_BRIDGE_SETUP_FILE   — absolute path to vitest.setup.js
//   CERTA_BRIDGE_TEST_DIR     — absolute path to compiled test directory
//   ELECTRON_SHARD_ID         — shard identifier (for parallel execution)
//   ELECTRON_CACHE_DIR        — isolated cache directory for this shard
//   ELECTRON_TEST_GLOB        — glob pattern for test files (default: "**/*.test.js")
//   ELECTRON_TEST_GREP        — regex pattern to filter test names
//   ELECTRON_SESSION_TIMEOUT  — safety timeout in ms (default: 300000)

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { executeRegisteredCallback } from "../callbackRegistry.js";
import { buildRendererHarness } from "./renderer-harness.js";
import type { RendererTestResults } from "./types.js";

// Prevent EPIPE crashes when stdout/stderr pipes close during shutdown
process.stdout.on("error", () => {});
process.stderr.on("error", () => {});

const backendInitModule = process.env.CERTA_BRIDGE_BACKEND_INIT;
const setupFile = process.env.CERTA_BRIDGE_SETUP_FILE;
const testDir = process.env.CERTA_BRIDGE_TEST_DIR;
const shardId = process.env.ELECTRON_SHARD_ID || `pid-${process.pid}`;
const testGlob = process.env.ELECTRON_TEST_GLOB || "**/*.test.js";
const grepPattern = process.env.ELECTRON_TEST_GREP;
const sessionTimeout = Number(process.env.ELECTRON_SESSION_TIMEOUT || "300000");

if (!backendInitModule || !setupFile || !testDir) {
  console.error("Missing required env vars: CERTA_BRIDGE_BACKEND_INIT, CERTA_BRIDGE_SETUP_FILE, CERTA_BRIDGE_TEST_DIR");
  process.exit(1);
}

const bridgeToken = crypto.randomUUID();

// Set unique userData directory per shard to prevent contention on the shared token store
// (electron-store + safeStorage) when multiple Electron processes run in parallel.
if (process.env.ELECTRON_CACHE_DIR) {
  app.setPath("userData", path.join(process.env.ELECTRON_CACHE_DIR, "electron-user-data"));
}

// Polyfill globalThis.crypto for Electron main process.
// Some backend modules (e.g. @itwin/core-bentley's Guid.createValue) call crypto.randomUUID()
// as a bare global. In Electron's main process the Web Crypto API may not be exposed globally,
// so we polyfill it from Node's built-in crypto module.
if (typeof (globalThis as any).crypto === "undefined") {
  (globalThis as any).crypto = crypto.webcrypto;
}

async function main() {
  await app.whenReady();

  // Intercept ALL ipcMain.handle calls so we can log what channels get registered.
  // Must be installed BEFORE backend init to capture ElectronHost.startup() registrations.
  const registeredChannels: string[] = [];
  const origHandle = ipcMain.handle.bind(ipcMain);
  (ipcMain as any).handle = (channel: string, listener: any) => {
    registeredChannels.push(channel);
    return origHandle(channel, listener);
  };

  // Initialize backend (registers RPC impls, callbacks, etc.)
  console.log("[session] Starting backend init...");
  const backendInit = require(backendInitModule!); // eslint-disable-line @typescript-eslint/no-require-imports
  if (backendInit && typeof backendInit.then === "function")
    await backendInit;
  console.log("[session] Backend init complete. Registered IPC handlers so far:", registeredChannels);

  // Set up IPC bridge for backend callbacks
  ipcMain.handle("certa-callback", async (_event, payload: { token: string; name: string; args: any[] }) => {
    try {
      if (payload.token !== bridgeToken)
        throw new Error("Invalid bridge token");
      const result = await executeRegisteredCallback(payload.name, payload.args);
      return { result };
    } catch (err: any) {
      return { error: { message: err.message, stack: err.stack } };
    }
  });

  // Listen for test results from the renderer
  ipcMain.once("electron-test-results", (_event, results: RendererTestResults) => {
    console.log(`\nElectron renderer tests: ${results.passed} passed, ${results.failed} failed`);
    if (results.errors.length > 0) {
      console.error("Failures:");
      results.errors.forEach((e: string) => console.error(`  ✗ ${e}`));
    }
    process.exit(results.failed > 0 ? 1 : 0);
  });

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1024,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,  // prevent timer throttling in hidden windows
    },
  });

  // Forward renderer console output to main process stdout/stderr so we see
  // test progress even if process.stdout in the renderer is not inherited.
  const shardLabel = `[${shardId}]`;
  win.webContents.on("console-message", (_event: Electron.Event, level: number, message: string) => {
    if (level >= 2) process.stderr.write(`${shardLabel} ${message}\n`);
    else process.stdout.write(`${shardLabel} ${message}\n`);
  });

  // Detect renderer crashes (e.g. WebGL failures, OOM) and exit immediately
  // instead of waiting for the full session timeout.
  win.webContents.on("render-process-gone", (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
    console.error(`${shardLabel} Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
    process.exit(1);
  });

  // Discover test files
  let testFiles: string[];
  const manifestPath = process.env.ELECTRON_CACHE_DIR
    ? path.join(process.env.ELECTRON_CACHE_DIR, "test-manifest.txt")
    : undefined;

  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, "utf8").trim();
    testFiles = manifest.split("\n").map((f) => path.resolve(testDir!, f));
  } else {
    const { globSync } = require("glob"); // eslint-disable-line @typescript-eslint/no-require-imports
    testFiles = globSync(testGlob, { cwd: testDir, absolute: true, windowsPathsNoEscape: true });
  }

  if (testFiles.length === 0) {
    console.error("No test files found in", testDir);
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test files to run in Electron renderer`);

  // Build the renderer HTML with the complete test harness
  const rendererScript = buildRendererHarness({ bridgeToken, setupFile: setupFile!, testFiles, grepPattern });

  const tempHtmlPath = path.join(testDir!, "..", "electron", `_test-runner-${shardId}.html`);
  const htmlDir = path.dirname(tempHtmlPath);
  if (!fs.existsSync(htmlDir))
    fs.mkdirSync(htmlDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html>
<head><title>Electron Full-Stack Tests</title></head>
<body>
  <div id="test-root"></div>
  <script>${rendererScript}</script>
</body>
</html>`;
  fs.writeFileSync(tempHtmlPath, html, "utf8");
  await win.loadFile(tempHtmlPath);

  // Safety timeout
  setTimeout(() => {
    console.error(`Electron tests timed out after ${sessionTimeout}ms`);
    process.exit(1);
  }, sessionTimeout);
}

main().catch((err) => {
  console.error("Electron main process error:", err);
  process.exit(1);
});
