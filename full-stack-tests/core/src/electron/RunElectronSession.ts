/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Electron main process entry point for full-stack-tests/core renderer tests.
// Single-session approach: one Electron process, one BrowserWindow, all tests run sequentially.
// Matches Certa's Electron runner behavior but without webpack bundling.

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { executeRegisteredCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";

// Load .env before anything else
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;
  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error)
    throw envResult.error;
  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, "..", "..", ".env"));

// Session token for IPC bridge authentication
const bridgeToken = crypto.randomUUID();

async function main() {
  await app.whenReady();

  // Initialize backend (Electron path from backend.ts — starts ElectronHost, registers RPC, etc.)
  const backendInit = require("../backend/backend"); // eslint-disable-line @typescript-eslint/no-require-imports
  if (backendInit && typeof backendInit.then === "function")
    await backendInit;

  // Set up async IPC bridge for backend callbacks (e.g., setBackendAccessToken)
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
  ipcMain.once("electron-test-results", (_event, results: { passed: number; failed: number; errors: string[] }) => {
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
    },
  });

  // Get test files — all .test.js files in the compiled frontend output
  const testGlob = process.env.ELECTRON_TEST_GLOB || "**/*.test.js";
  const testDir = path.resolve(__dirname, "..", "frontend");
  const { globSync } = require("glob"); // eslint-disable-line @typescript-eslint/no-require-imports
  const testFiles: string[] = globSync(testGlob, { cwd: testDir, absolute: true, windowsPathsNoEscape: true });

  if (testFiles.length === 0) {
    console.error("No test files found in", testDir);
    process.exit(1);
  }

  // Allow filtering by grep pattern (like Certa's --grep)
  const grepPattern = process.env.ELECTRON_TEST_GREP;

  console.log(`Found ${testFiles.length} test files to run in Electron renderer`);

  const setupFilePath = path.resolve(testDir, "vitest.setup.js");

  // Build inline renderer script that:
  // 1. Sets up IPC bridge shim (_CertaSendToBackend)
  // 2. Provides Mocha-compatible describe/it/before/after globals
  // 3. Loads setup + all test files
  // 4. Runs tests and reports results via IPC
  const rendererScript = buildRendererScript(bridgeToken, setupFilePath, testFiles, grepPattern);

  const html = `<!DOCTYPE html>
<html>
<head><title>Electron Full-Stack Tests</title></head>
<body>
  <div id="test-root"></div>
  <script>${rendererScript}</script>
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Safety timeout — 4 minutes (matches Certa's 240s mocha timeout)
  setTimeout(() => {
    console.error("Electron tests timed out after 240 seconds");
    process.exit(1);
  }, 240_000);
}

/**
 * Generates the renderer-side JavaScript that sets up the test harness.
 * Runs inside BrowserWindow with nodeIntegration — has access to require(), DOM, and IPC.
 */
function buildRendererScript(token: string, setupFile: string, testFiles: string[], grepPattern?: string): string {
  return `
    const { ipcRenderer } = require("electron");

    // --- IPC bridge for backend callbacks ---
    window._CertaSendToBackend = async function(name, args) {
      const response = await ipcRenderer.invoke("certa-callback", {
        token: ${JSON.stringify(token)},
        name: name,
        args: args,
      });
      if (response.error) {
        const err = new Error(response.error.message);
        if (response.error.stack) err.stack = response.error.stack;
        throw err;
      }
      return response.result;
    };
    window.__CERTA_BRIDGE_TOKEN__ = ${JSON.stringify(token)};

    // --- Minimal Mocha-compatible test runner ---
    const suites = [];
    let suiteStack = [];
    const pendingResults = { passed: 0, failed: 0, errors: [] };

    globalThis.describe = function(name, fn) {
      const suite = { name, tests: [], beforeAlls: [], afterAlls: [], beforeEachs: [], afterEachs: [], children: [] };
      if (suiteStack.length > 0) {
        suiteStack[suiteStack.length - 1].children.push(suite);
      } else {
        suites.push(suite);
      }
      suiteStack.push(suite);
      fn();
      suiteStack.pop();
    };
    globalThis.it = function(name, fn) {
      if (suiteStack.length > 0) {
        suiteStack[suiteStack.length - 1].tests.push({ name, fn });
      }
    };
    globalThis.before = function(fn) {
      if (suiteStack.length > 0) suiteStack[suiteStack.length - 1].beforeAlls.push(fn);
    };
    globalThis.after = function(fn) {
      if (suiteStack.length > 0) suiteStack[suiteStack.length - 1].afterAlls.push(fn);
    };
    globalThis.beforeEach = function(fn) {
      if (suiteStack.length > 0) suiteStack[suiteStack.length - 1].beforeEachs.push(fn);
    };
    globalThis.afterEach = function(fn) {
      if (suiteStack.length > 0) suiteStack[suiteStack.length - 1].afterEachs.push(fn);
    };

    const grepPattern = ${grepPattern ? JSON.stringify(grepPattern) : "null"};
    const grepRegex = grepPattern ? new RegExp(grepPattern) : null;

    function matchesGrep(name) {
      return !grepRegex || grepRegex.test(name);
    }

    async function runSuite(suite, parentPath, parentBeforeEachs, parentAfterEachs) {
      const suitePath = parentPath ? parentPath + " > " + suite.name : suite.name;
      const allBeforeEachs = [...parentBeforeEachs, ...suite.beforeEachs];
      const allAfterEachs = [...suite.afterEachs, ...parentAfterEachs];

      try {
        for (const fn of suite.beforeAlls) await fn();
      } catch (err) {
        pendingResults.failed++;
        pendingResults.errors.push(suitePath + " [before all]: " + err.message);
        return;
      }

      for (const test of suite.tests) {
        const testPath = suitePath + " > " + test.name;
        if (!matchesGrep(testPath)) continue;
        try {
          for (const fn of allBeforeEachs) await fn();
          await test.fn();
          for (const fn of allAfterEachs) await fn();
          pendingResults.passed++;
          process.stdout.write("  \\u2713 " + test.name + "\\n");
        } catch (err) {
          pendingResults.failed++;
          pendingResults.errors.push(testPath + ": " + (err.message || err));
          process.stderr.write("  \\u2717 " + test.name + ": " + (err.message || err) + "\\n");
        }
      }

      for (const child of suite.children) {
        await runSuite(child, suitePath, allBeforeEachs, allAfterEachs);
      }

      try {
        for (const fn of suite.afterAlls) await fn();
      } catch (err) {
        process.stderr.write(suitePath + " [after all]: " + err.message + "\\n");
      }
    }

    async function runAllTests() {
      // Load setup (registers Chai plugins, RPC init, error handling)
      require(${JSON.stringify(setupFile)});

      // Load all test files (registers describe/it at module scope)
      const testFiles = ${JSON.stringify(testFiles)};
      for (const file of testFiles) {
        try {
          require(file);
        } catch (err) {
          console.error("Failed to load " + file + ": " + err.message);
        }
      }

      // Run all registered suites
      for (const suite of suites) {
        console.log("\\nSuite:", suite.name);
        await runSuite(suite, "", [], []);
      }

      ipcRenderer.send("electron-test-results", pendingResults);
    }

    // Delay to let module-level code complete
    setTimeout(() => runAllTests().catch(err => {
      console.error("Test runner error:", err);
      ipcRenderer.send("electron-test-results", { passed: 0, failed: 1, errors: [err.message] });
    }), 200);
  `;
}

main().catch((err) => {
  console.error("Electron main process error:", err);
  process.exit(1);
});
