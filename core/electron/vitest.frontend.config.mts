/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { electron } from "@itwin/vitest-browser-bridge/electron-provider";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { target: "esnext" },
  optimizeDeps: {
    force: true,
    include: ["@itwin/core-bentley", "@itwin/core-common", "@itwin/core-frontend"],
    exclude: ["electron"],
    esbuildOptions: { target: "esnext" },
  },
  server: {
    fs: {
      allow: [path.resolve(packageRoot, "../..")],
    },
  },
  test: {
    dir: "src/test/frontend",
    include: ["**/ElectronApp.test.ts"],
    testTimeout: 60000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/frontend_junit_results.xml" }],
    ],
    browser: {
      enabled: true,
      provider: electron({
        backendInitModule: path.resolve(packageRoot, "lib/cjs/test/frontend/utils/backend.js"),
        preloadModule: path.resolve(packageRoot, "lib/cjs/backend/ElectronPreload.js"),
      }),
      instances: [{ browser: "electron" }],
      headless: true,
      screenshotFailures: false,
    },
  },
});
