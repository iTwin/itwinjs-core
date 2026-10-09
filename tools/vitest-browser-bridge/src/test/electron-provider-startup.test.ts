/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { ElectronBrowserProvider } from "../electron/provider.js";

const packageRoot = process.cwd();
const compiledRoot = path.join(packageRoot, "lib/cjs");
const project = {
  config: {
    root: packageRoot,
    browser: { headless: true },
  },
};

describe("Electron provider startup", () => {
  it("fails the session when the consumer preload throws", async () => {
    const provider = new ElectronBrowserProvider(
      project,
      { preloadModule: path.join(compiledRoot, "test/fixtures/electron-provider-throwing-preload.js") },
      path.join(compiledRoot, "electron/provider-session.js"),
      { startupTimeout: 30_000 },
    );
    try {
      await expect(provider.openPage("throwing-preload", "data:text/html,preload", { parallel: false }))
        .rejects.toThrow(/electron-provider-throwing-preload\.js.*intentional preload failure/);
    } finally {
      await provider.close();
    }
  }, 60_000);
});
