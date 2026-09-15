/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = process.cwd();

describe("package boundaries", () => {
  it("exposes only the provider and narrow callback subpaths", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(packageJson.exports)).toEqual([
      "./electron-provider",
      "./callbacks/protocol",
      "./callbacks/backend",
      "./callbacks/browser",
      "./callbacks/electron",
    ]);
    expect(packageJson.exports["."]).toBeUndefined();
  });

  it("keeps the browser callback module free of Electron imports", () => {
    const browserSource = fs.readFileSync(path.join(packageRoot, "src/callbacks/browser.ts"), "utf8");
    expect(browserSource).not.toMatch(/from ["']electron["']/);
    expect(browserSource).not.toContain("node:electron");
  });
});
