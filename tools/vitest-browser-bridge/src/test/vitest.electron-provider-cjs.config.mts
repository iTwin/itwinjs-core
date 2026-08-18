/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
type ElectronFactory = typeof import("@itwin/vitest-browser-bridge/electron-provider").electron;

const require = createRequire(import.meta.url);
const { electron } = require("@itwin/vitest-browser-bridge/electron-provider") as {
  electron: ElectronFactory;
};
const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(dirname, "../..");
const compiledFixtureRoot = path.join(packageRoot, "lib/cjs/test/fixtures");

export default defineConfig({
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
