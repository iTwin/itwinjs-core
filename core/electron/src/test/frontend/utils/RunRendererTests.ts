/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Electron main process entry point for renderer frontend tests.
// Creates a BrowserWindow, loads a simple test harness HTML page,
// executes the compiled test code in the renderer, and reports results.

import { app, BrowserWindow, ipcMain } from "electron";
import { ElectronHost } from "../../../ElectronBackend";
import * as path from "path";

async function main() {
  await app.whenReady();
  await ElectronHost.startup();

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Simple HTML that loads the test bundle via <script> tag
  const testBundlePath = path.resolve(__dirname, "../ElectronApp.test.js");

  // Listen for test completion from the renderer
  ipcMain.once("test-done", (_event, failCount: number) => {
    console.log(`Renderer tests completed. Failures: ${failCount}`);
    process.exit(failCount > 0 ? 1 : 0);
  });

  // Provide inline HTML with a Mocha-like harness that uses the existing test assertions
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Electron Frontend Tests</title></head>
    <body>
      <script>
        // Minimal test harness — collects describe/it results and reports via IPC
        const { ipcRenderer } = require("electron");
        const results = { pass: 0, fail: 0, errors: [] };

        // Patch global describe/it for Mocha-style tests
        const suites = [];
        let currentSuite = null;
        globalThis.describe = function(name, fn) {
          currentSuite = { name, tests: [] };
          suites.push(currentSuite);
          fn();
          currentSuite = null;
        };
        globalThis.it = function(name, fn) {
          if (currentSuite) currentSuite.tests.push({ name, fn });
        };

        // Provide assert from chai (loaded via the test file's own import)
        async function runTests() {
          for (const suite of suites) {
            console.log("Suite:", suite.name);
            for (const test of suite.tests) {
              try {
                await test.fn();
                results.pass++;
                console.log("  ✓", test.name);
              } catch (err) {
                results.fail++;
                results.errors.push(suite.name + " > " + test.name + ": " + err.message);
                console.error("  ✗", test.name, err);
              }
            }
          }
          if (results.errors.length > 0) {
            console.error("\\nFailed tests:");
            results.errors.forEach(e => console.error("  -", e));
          }
          ipcRenderer.send("test-done", results.fail);
        }

        // Load the test module — it will call describe/it at module scope
        require(${JSON.stringify(testBundlePath)});

        // Run after module-level describe/it registration
        setTimeout(() => runTests().catch(err => {
          console.error("Test runner error:", err);
          ipcRenderer.send("test-done", 1);
        }), 100);
      </script>
    </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Timeout safety — if tests don't complete in 30s, exit with failure
  setTimeout(() => {
    console.error("Renderer tests timed out after 30 seconds");
    process.exit(1);
  }, 30_000);
}

main().catch((err) => {
  console.error("Electron main process error:", err);
  process.exit(1);
});
