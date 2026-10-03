/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { electron } from "@itwin/vitest-browser-bridge/electron-provider";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(dirname, "../..");
const compiledFixtureRoot = path.join(packageRoot, "lib/cjs/test/fixtures");

export default defineConfig({
  // The renderer is always Electron's bundled Chromium, so Vite's conservative default
  // browser target only downlevels needlessly, and esbuild cannot downlevel some of the
  // destructuring in Vitest's own dependencies.
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
  test: {
    dir: "src/test",
    include: ["electron-provider-smoke.test.ts"],
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: electron({
        backendInitModule: path.join(compiledFixtureRoot, "electron-provider-backend-init.js"),
        preloadModule: path.join(compiledFixtureRoot, "electron-provider-user-preload.js"),
      }),
      instances: [{ browser: "electron" }],
      headless: true,
    },
  },
});
