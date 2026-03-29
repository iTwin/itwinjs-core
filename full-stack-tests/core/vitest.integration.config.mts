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
    testTimeout: 600000,
    hookTimeout: 600000,
    include: [
      "**/hub/**/*.test.ts",
      "**/map/**/*.test.ts",
      // BriefcaseConnection.test.ts is Electron-only (gated by ProcessDetector.isElectronAppFrontend).
      // It runs via test:integration:electron, not here.
      "**/RealityDataAccess.test.ts",
      "**/QueryExtents.test.ts",
    ],
    exclude: [
      // SheetViewState and SectionDrawing are pure rendering tests (no external HTTP).
      // They run in Electron integration instead — Vitest's Playwright browser mode is ~7x
      // slower for tile rendering on CI (2-core VM), causing these to exceed Chrome timeouts.
      "**/hub/SheetViewState.test.ts",
      "**/hub/SectionDrawing.test.ts",
    ],
  },
}));
