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
import { dispatchCallback } from "../callbackRegistry.js";
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
const sessionTimeout = Number(process.env.ELECTRON_SESSION_TIMEOUT || "600000");
const testTimeout = process.env.ELECTRON_TEST_TIMEOUT ? Number(process.env.ELECTRON_TEST_TIMEOUT) : undefined;
const hookTimeout = process.env.ELECTRON_HOOK_TIMEOUT ? Number(process.env.ELECTRON_HOOK_TIMEOUT) : undefined;
const importRewritePatterns: string[] = process.env.ELECTRON_IMPORT_REWRITE_PATTERNS
  ? JSON.parse(process.env.ELECTRON_IMPORT_REWRITE_PATTERNS)
  : [];
const rendererSetup: string | undefined = process.env.ELECTRON_RENDERER_SETUP
  ? Buffer.from(process.env.ELECTRON_RENDERER_SETUP, "base64").toString("utf8")
  : undefined;

if (!backendInitModule || !setupFile || !testDir) {
  console.error("Missing required env vars: CERTA_BRIDGE_BACKEND_INIT, CERTA_BRIDGE_SETUP_FILE, CERTA_BRIDGE_TEST_DIR");
  process.exit(1);
}

// TypeScript doesn't narrow after process.exit(), so re-bind with known types.
const _backendInitModule: string = backendInitModule;
const _setupFile: string = setupFile;
const _testDir: string = testDir;

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

// Enable SwiftShader software rendering on Linux CI (xvfb, no real GPU).
// On Windows (WARP) and macOS (Metal) the native GPU backends are more stable,
// so we let Electron auto-detect. Must be set before app.whenReady().
// See: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md
if (process.platform === "linux")
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");

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
  const backendMod = require(_backendInitModule);  // eslint-disable-line @typescript-eslint/no-require-imports
  const backendInit = backendMod?.default ?? backendMod;
  if (typeof backendInit === "function") await backendInit();
  else if (backendInit && typeof backendInit.then === "function") await backendInit;
  console.log("[session] Backend init complete. Registered IPC handlers so far:", registeredChannels);

  // Set up IPC bridge for backend callbacks
  ipcMain.handle("certa-callback", async (_event, payload: { token: string; name: string; args: any[] }) => {
    try {
      const result = await dispatchCallback(payload.name, payload.args, payload.token, bridgeToken);
      return { result };
    } catch (err: any) {
      return { error: { message: err.message, stack: err.stack } };
    }
  });

  // Guard against spurious render-process-gone after results have already been received.
  let testResultsReceived = false;

  // Listen for test results from the renderer
  ipcMain.once("electron-test-results", (_event, results: RendererTestResults) => {
    testResultsReceived = true;
    const label = `[${shardId}]`;
    console.log(`\n${label} Electron renderer tests: ${results.passed} passed, ${results.failed} failed`);
    if (results.errors.length > 0) {
      console.error(`${label} Failures:`);
      results.errors.forEach((e: string) => console.error(`${label}   ✗ ${e}`));
    }

    // Write structured results JSON so the runner can aggregate per-shard details.
    if (process.env.ELECTRON_CACHE_DIR) {
      const resultsPath = path.join(process.env.ELECTRON_CACHE_DIR, "test-results.json");
      try {
        fs.writeFileSync(resultsPath, JSON.stringify(results), "utf8");
      } catch {
        // Best-effort: runner will fall back to exit-code-only reporting.
      }
    }

    // Use app.quit() for graceful shutdown instead of app.exit() to allow
    // Node.js cleanup handlers and native addon destructors to run without
    // V8 being torn down underneath them. app.quit() fires before-quit/will-quit
    // events and drains the event loop before exiting.
    // Arm a fallback timer in case quit handlers hang.
    const exitCode = results.failed > 0 ? 1 : 0;
    process.exitCode = exitCode;
    const SHUTDOWN_TIMEOUT_MS = 5000;
    const fallback = setTimeout(() => {
      console.warn(`[${shardId}] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`);
      app.exit(exitCode);
    }, SHUTDOWN_TIMEOUT_MS);
    fallback.unref(); // Don't let the timer keep the process alive if quit succeeds
    app.quit();
  });

  const win = new BrowserWindow({
    show: false,
    // Intentionally omit width/height — use Electron's default (~800×600).
    // Larger framebuffers (e.g. 1280×1024) cause SwiftShader stack overflows
    // on Windows CI where there is no real GPU.
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
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
    if (testResultsReceived) {
      // Results already written — this is a post-test shutdown crash, safe to ignore.
      console.warn(`${shardLabel} Renderer process gone after results received: reason=${details.reason}, exitCode=${details.exitCode} — treating as post-test crash`);
      return;
    }
    console.error(`${shardLabel} Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
    // Write a minimal crash result so the runner can report a real failure
    // instead of treating the missing file as a silent timeout.
    if (process.env.ELECTRON_CACHE_DIR) {
      try {
        fs.writeFileSync(
          path.join(process.env.ELECTRON_CACHE_DIR, "test-results.json"),
          JSON.stringify({ passed: 0, failed: 1, skipped: 0, errors: [`Renderer crashed: ${details.reason} (exitCode=${details.exitCode})`] }),
        );
      } catch {}
    }
    process.exit(1);
  });

  // Discover test files
  let testFiles: string[];
  const manifestPath = process.env.ELECTRON_CACHE_DIR
    ? path.join(process.env.ELECTRON_CACHE_DIR, "test-manifest.txt")
    : undefined;

  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, "utf8").trim();
    testFiles = manifest.split("\n").map((f) => path.resolve(_testDir, f));
  } else {
    const { globSync } = require("glob");  
    testFiles = globSync(testGlob, { cwd: testDir, absolute: true, windowsPathsNoEscape: true });
  }

  if (testFiles.length === 0) {
    console.error("No test files found in", testDir);
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test files to run in Electron renderer`);

  // Build the renderer HTML with the complete test harness
  const rendererScript = buildRendererHarness({ bridgeToken, setupFile: _setupFile, testFiles, grepPattern, testTimeout, hookTimeout, importRewritePatterns, rendererSetup });

  const tempHtmlPath = path.join(_testDir, "..", "electron", `_test-runner-${shardId}.html`);
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

  // Best-effort cleanup of temp HTML file on exit
  process.on("exit", () => {
    try { fs.rmSync(tempHtmlPath, { force: true }); } catch {}
  });

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
