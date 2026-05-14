/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
  test: {
    dir: "src/test/frontend",
    include: ["**/ElectronApp.test.ts"],
    testTimeout: 60000,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/frontend_junit_results.xml" }],
    ],
    browser: {
      enabled: true,
      provider: "@itwin/vitest-certa-bridge/electron-provider",
      instances: [
        {
          browser: "electron",
          backendInitModule: path.resolve(__dirname, "lib/cjs/test/frontend/utils/backend.js"),
          preloadModule: path.resolve(__dirname, "lib/cjs/backend/ElectronPreload.js"),
        },
      ],
      headless: true,
      isolate: false,
      screenshotFailures: false,
    },
  },
});
