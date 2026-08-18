/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = process.cwd();
const require = createRequire(import.meta.url);

describe("package boundaries", () => {
  it("exposes only consumer-facing provider and callback subpaths", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(new Set(Object.keys(packageJson.exports))).toEqual(new Set([
      "./electron-provider",
      "./callbacks/backend",
      "./callbacks/browser",
    ]));
    expect(packageJson.exports["."]).toBeUndefined();
  });

  it("loads every built consumer entry through both package conditions", async () => {
    expect(require("@itwin/vitest-browser-bridge/electron-provider").electron).toBeTypeOf("function");
    expect((await import("@itwin/vitest-browser-bridge/electron-provider")).electron).toBeTypeOf("function");
    expect(require("@itwin/vitest-browser-bridge/callbacks/backend").registerBackendCallback).toBeTypeOf("function");
    expect((await import("@itwin/vitest-browser-bridge/callbacks/backend")).registerBackendCallback).toBeTypeOf("function");
    expect(require("@itwin/vitest-browser-bridge/callbacks/browser").invokeBackendCallback).toBeTypeOf("function");
    expect((await import("@itwin/vitest-browser-bridge/callbacks/browser")).invokeBackendCallback).toBeTypeOf("function");
  });

  it("keeps the browser callback module free of Electron imports", () => {
    const browserSource = fs.readFileSync(path.join(packageRoot, "src/callbacks/browser.ts"), "utf8");
    expect(browserSource).not.toMatch(/from ["']electron["']/);
    expect(browserSource).not.toContain("node:electron");
  });
});
