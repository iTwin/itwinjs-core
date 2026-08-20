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
  resolve: {
    alias: {
      "@itwin/certa/lib/utils/CallbackUtils": path.resolve(packageRoot, "src/frontend/vitestCallbackUtils.ts"),
      "@itwin/core-electron/lib/cjs/ElectronFrontend": path.resolve(packageRoot, "../../core/electron/src/ElectronFrontend.ts"),
      "@itwin/core-mobile/lib/cjs/MobileFrontend": path.resolve(packageRoot, "../../core/mobile/src/MobileFrontend.ts"),
    },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    force: true,
    include: [
      "@itwin/core-bentley",
      "@itwin/core-common",
      "@itwin/core-frontend",
    ],
    exclude: ["electron"],
    esbuildOptions: { target: "esnext" },
  },
  server: {
    fs: {
      allow: [path.resolve(packageRoot, "../..")],
    },
  },
  test: {
    dir: "src/frontend",
    include: ["**/*.test.ts"],
    exclude: ["**/Mobile.test.ts", "**/Routing.test.ts", "**/Rpc.HttpProtocol.test.ts", "**/_Setup.test.ts"],
    setupFiles: [path.resolve(packageRoot, "src/frontend/vitest.setup.ts")],
    globals: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
    browser: {
      enabled: true,
      provider: electron({
        backendInitModule: path.resolve(packageRoot, "lib/backend/vitest-electron.js"),
        preloadModule: path.resolve(packageRoot, "../../core/electron/lib/cjs/backend/ElectronPreload.js"),
      }),
      instances: [{ browser: "electron" }],
      headless: true,
      screenshotFailures: false,
    },
  },
});
