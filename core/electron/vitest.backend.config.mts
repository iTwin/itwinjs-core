/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { target: "esnext" },
  optimizeDeps: {
    force: true,
    include: ["@itwin/core-backend", "@itwin/core-bentley", "@itwin/core-common"],
    exclude: ["electron"],
    esbuildOptions: { target: "esnext" },
  },
  server: {
    fs: {
      allow: [path.resolve(packageRoot, "../..")],
    },
  },
  test: {
    dir: "src/test/backend",
    include: ["**/RunElectronBackendTests.test.ts"],
    environment: "node",
    testTimeout: 60000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/backend_junit_results.xml" }],
    ],
  },
});
