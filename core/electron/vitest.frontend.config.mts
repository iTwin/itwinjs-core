/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test/frontend",
    include: ["**/RunElectronFrontendTests.ts"],
    testTimeout: 60000,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/frontend_junit_results.xml" }],
    ],
    // Spawns Electron process per test — runs in Node.js, not browser
    pool: "forks",
  },
});
