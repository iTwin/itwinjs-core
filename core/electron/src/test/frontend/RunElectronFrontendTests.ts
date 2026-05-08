/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Vitest test file that spawns Electron and runs frontend tests in a BrowserWindow renderer.
// Pattern: Vitest describe/it wrapper → spawns Electron → runs tests in renderer → reports result.

import { assert, describe, it } from "vitest";
import { spawn, SpawnOptions } from "child_process";
import * as path from "path";

/** Spawns Electron process to run frontend tests in a renderer BrowserWindow. */
async function spawnElectronRendererTests(): Promise<number> {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-require-imports

  const args = [
    path.resolve(process.cwd(), "lib/cjs/test/frontend/utils/RunRendererTests.js"),
  ];

  const options: SpawnOptions = {
    stdio: ["ipc", "inherit", "inherit"],
    cwd: process.cwd(),
    env: {
      ...process.env,
    },
  };

  const electronProcess = spawn(command, args, options);

  return new Promise((resolve) => {
    electronProcess.on("exit", (status) => resolve(status || 0));
  });
}

describe("ElectronApp Frontend Tests (renderer)", () => {
  it("should pass all renderer tests", async () => {
    const exitCode = await spawnElectronRendererTests();
    assert.equal(exitCode, 0, "Electron renderer tests failed");
  }, 60_000);
});
