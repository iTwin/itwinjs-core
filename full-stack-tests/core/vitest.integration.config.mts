/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Integration/performance Chrome test config.
// Runs only #integration and #performance tagged tests (requires OIDC credentials).
// Extends the base vitest.config.mts but overrides include to target hub/map/integration files.

import baseConfig from "./vitest.config.mts";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    testTimeout: 240000,
    hookTimeout: 240000,
    include: [
      "**/hub/**/*.test.ts",
      "**/map/**/*.test.ts",
      // BriefcaseConnection.test.ts is Electron-only (gated by ProcessDetector.isElectronAppFrontend).
      // It runs via test:integration:electron, not here.
      "**/RealityDataAccess.test.ts",
      "**/QueryExtents.test.ts",
    ],
    browser: {
      // Override headless for integration tests — rendering/tile tests need a real display
      // context (via Xvfb on CI) for requestAnimationFrame and WebGL to work properly.
      // Headless Chromium throttles/pauses rAF for "hidden" pages, causing tile-loading
      // tests (waitForAllTilesToRender) to timeout.
      headless: false,
    },
  },
}));
