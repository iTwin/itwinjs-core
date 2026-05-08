/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(dirname, "../..");
const compiledFixtureRoot = path.join(packageRoot, "lib/cjs/test/fixtures");

// This config exercises this package's provider implementation. The backend/preload modules
// are checked-in TypeScript test fixtures compiled by `build:test-fixtures`, not consumer-facing
// examples. Consumers still need a Vitest config because test globs, reporters, backend init
// modules, and preload modules are package-specific. The provider supplies the Electron runtime,
// not a universal test suite layout.
export default defineConfig({
  test: {
    dir: "src/test",
    include: ["electron-provider-smoke.test.ts"],
    browser: {
      enabled: true,
      provider: "@itwin/vitest-certa-bridge/electron-provider",
      instances: [
        {
          browser: "electron",
          backendInitModule: path.join(compiledFixtureRoot, "electron-provider-backend-init.js"),
          preloadModule: path.join(compiledFixtureRoot, "electron-provider-user-preload.js"),
        },
      ],
      headless: true,
      isolate: false,
      screenshotFailures: false,
    },
  },
});
