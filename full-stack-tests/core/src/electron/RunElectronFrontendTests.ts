/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Vitest wrapper that spawns a single Electron session to run all renderer tests.
// Single-session approach: one Electron process runs all tests sequentially (matches Certa behavior).
// Exit code 0 = all pass, 1 = failures detected.

import { assert, describe, it } from "vitest";
import { spawn, SpawnOptions } from "child_process";
import * as path from "path";

/**
 * Spawns an Electron process running RunElectronSession.js.
 * Tests execute inside a BrowserWindow renderer and results are reported via exit code.
 */
async function spawnElectronSession(grepPattern?: string, invertGrep?: boolean): Promise<number> {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-require-imports

  const args = [
    path.resolve(process.cwd(), "lib/electron/RunElectronSession.js"),
  ];

  const env: Record<string, string> = { ...process.env as Record<string, string> };

  // Support grep filtering (same as Certa's --grep / --invert)
  if (grepPattern) {
    if (invertGrep) {
      // Invert: run tests that do NOT match
      env.ELECTRON_TEST_GREP = `^((?!${grepPattern}).)*$`;
    } else {
      env.ELECTRON_TEST_GREP = grepPattern;
    }
  }

  const options: SpawnOptions = {
    stdio: ["ipc", "inherit", "inherit"],
    cwd: process.cwd(),
    env,
  };

  const electronProcess = spawn(command, args, options);

  return new Promise((resolve) => {
    electronProcess.on("exit", (status) => resolve(status || 0));
  });
}

// Determine test filter from environment (set by npm scripts)
const grepPattern = process.env.VITEST_ELECTRON_GREP;
const invertGrep = process.env.VITEST_ELECTRON_INVERT === "true";

describe("Full-Stack Tests (Electron Renderer)", () => {
  it("should pass all Electron renderer tests", async () => {
    const exitCode = await spawnElectronSession(grepPattern, invertGrep);
    assert.equal(exitCode, 0, "Electron renderer tests had failures — check output above");
  }, 300_000); // 5 minute timeout for full suite
});
