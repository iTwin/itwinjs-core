/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    testTimeout: 50000,
    browser: {
      provider: playwright(),
      enabled: true,
      instances: [
        { browser: "chromium" },
      ],
      headless: true,
      screenshotFailures: false,
    },
    reporters: ["default", "junit"],
    outputFile: {
      junit: "lib/test/junit_results.xml",
    },
    coverage: {
      provider: "v8",
      include: [
        "src/**/*",
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/test/**/*",
        "**/*.d.ts",
        "**/*.d.tsx",
      ],
      reporter: [
        "text-summary",
        "lcov",
        "cobertura",
      ],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      target: "es2022",
    },
  },
});
