/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";

// Electron mode: spawns a real Electron process with BrowserWindow.
// Tests run inside the renderer (DOM + Node.js) — NOT in Vitest browser mode.
// Vitest acts as the orchestrator only (pool: "forks", Node.js mode).
export default defineConfig({
  test: {
    dir: "src/electron",
    include: ["**/RunElectronFrontendTests.ts"],
    testTimeout: 300_000,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/electron_junit_results.xml" }],
    ],
    // Node.js mode — Vitest spawns RunElectronFrontendTests which spawns Electron
    pool: "forks",
  },
});
