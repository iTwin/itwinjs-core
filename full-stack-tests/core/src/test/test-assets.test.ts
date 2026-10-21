/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveTestAssetPath } from "../backend/testAssets";

describe("resolveTestAssetPath", () => {
  let root: string;
  let assets: string;
  let outside: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "test-assets-"));
    assets = path.join(root, "assets");
    fs.mkdirSync(path.join(assets, "nested"), { recursive: true });
    fs.writeFileSync(path.join(assets, "nested", "model.bim"), "");
    outside = path.join(root, "secret.txt");
    fs.writeFileSync(outside, "");
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("accepts a file inside the assets directory", () => {
    expect(resolveTestAssetPath(path.join(assets, "nested", "model.bim"), assets)).toBe(fs.realpathSync(path.join(assets, "nested", "model.bim")));
  });

  it("rejects paths outside the assets directory, including traversal", () => {
    for (const sourcePath of [outside, path.join(assets, "..", "secret.txt"), assets])
      expect(() => resolveTestAssetPath(sourcePath, assets)).toThrow("Only files in");
  });

  it("rejects an outside path without checking whether it exists", () => {
    expect(() => resolveTestAssetPath(path.join(root, "missing.bim"), assets)).toThrow("Only files in");
  });

  it("rejects a symlink inside the assets directory that points outside it", () => {
    const link = path.join(assets, "link.bim");
    try {
      fs.symlinkSync(outside, link);
    } catch {
      return; // Creating symlinks can require elevated rights on Windows.
    }
    expect(() => resolveTestAssetPath(link, assets)).toThrow("Only files in");
  });
});
