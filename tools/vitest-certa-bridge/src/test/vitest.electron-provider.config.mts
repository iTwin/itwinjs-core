/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(dirname, "../..");
const generatedFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "itwin-vitest-electron-provider-"));

function writeGeneratedFixture(fileName: string, source: string): string {
  const filePath = path.join(generatedFixtureDir, fileName);
  fs.writeFileSync(filePath, source, "utf8");
  return filePath;
}

const backendInitModule = writeGeneratedFixture("backend-init.cjs", `
const { app } = require("electron");
const { registerBackendCallback } = require(${JSON.stringify(path.join(packageRoot, "lib/cjs/index.js"))});

module.exports = function initElectronProviderBackendSmoke() {
  registerBackendCallback("electron-provider:add", (a, b) => a + b);
  registerBackendCallback("electron-provider:asyncEcho", async (value) => ({ echoed: value }));
  registerBackendCallback("electron-provider:mainProcessInfo", () => ({
    appReady: app.isReady(),
    electronVersion: process.versions.electron,
    processType: process.type,
  }));
};
`);

const preloadModule = writeGeneratedFixture("user-preload.cjs", `
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("__electronProviderUserPreload", {
  loaded: true,
  processType: process.type,
});
`);

// This config exercises this package's provider implementation. The smoke backend/preload
// modules are generated above because they are test fixtures, not consumer-facing examples.
// Consumers still need a Vitest config because test globs, reporters, backend init modules,
// and preload modules are package-specific. The provider supplies the Electron runtime, not a
// universal test suite layout.
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
          backendInitModule,
          preloadModule,
        },
      ],
      headless: true,
      isolate: false,
      screenshotFailures: false,
    },
  },
});
