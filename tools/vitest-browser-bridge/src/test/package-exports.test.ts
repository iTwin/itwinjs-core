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
  it("exposes only the intended module conditions", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
      exports: Record<string, { import?: unknown; require?: unknown }>;
    };
    expect(new Set(Object.keys(packageJson.exports))).toEqual(new Set([
      "./electron-provider",
      "./callbacks/backend",
      "./callbacks/browser",
    ]));
    expect(packageJson.exports["."]).toBeUndefined();
    expect(packageJson.exports["./electron-provider"]).toMatchObject({ import: expect.anything() });
    expect(packageJson.exports["./electron-provider"].require).toBeUndefined();
    expect(packageJson.exports["./callbacks/backend"]).toMatchObject({
      import: expect.anything(),
      require: expect.anything(),
    });
    expect(packageJson.exports["./callbacks/browser"]).toMatchObject({ import: expect.anything() });
    expect(packageJson.exports["./callbacks/browser"].require).toBeUndefined();
  });

  it("loads consumer entries through their supported conditions", async () => {
    expect((await import("@itwin/vitest-browser-bridge/electron-provider")).electron).toBeTypeOf("function");
    expect((await import("@itwin/vitest-browser-bridge/callbacks/backend")).registerBackendCallback).toBeTypeOf("function");
    expect(require("@itwin/vitest-browser-bridge/callbacks/backend").registerBackendCallback).toBeTypeOf("function");
    expect((await import("@itwin/vitest-browser-bridge/callbacks/browser")).invokeBackendCallback).toBeTypeOf("function");
  });

  it("emits CommonJS only for backend and internal Electron code", () => {
    expect(fs.existsSync(path.join(packageRoot, "lib/cjs/electron-provider.js"))).toBe(false);
    expect(fs.existsSync(path.join(packageRoot, "lib/cjs/callbacks/browser.js"))).toBe(false);
    expect(fs.existsSync(path.join(packageRoot, "lib/cjs/callbacks/backend.js"))).toBe(true);
    expect(fs.existsSync(path.join(packageRoot, "lib/cjs/electron/provider-session.js"))).toBe(true);
  });

  it("keeps the browser callback module free of Electron imports", () => {
    const browserSource = fs.readFileSync(path.join(packageRoot, "src/callbacks/browser.ts"), "utf8");
    expect(browserSource).not.toMatch(/from ["']electron["']/);
    expect(browserSource).not.toContain("node:electron");
  });
});
