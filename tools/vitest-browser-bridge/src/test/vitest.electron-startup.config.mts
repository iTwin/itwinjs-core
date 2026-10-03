/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from "vitest/config";

// Runs real Electron from the Node side against the built package, unlike the browser-mode smoke config.
export default defineConfig({
  test: {
    dir: "src/test",
    include: ["electron-provider-startup.test.ts"],
  },
});
