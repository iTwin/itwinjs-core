/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// The retained Certa runners load this Webpack bundle. A .d.ts module in it means some import
// resolved to type declarations instead of code, and has no runtime exports.
it("bundles only executable modules for the retained Certa runners", () => {
  const bundle = readFileSync(resolve(__dirname, "../../lib/dist/bundled-tests.js"), "utf8");
  // Development mode names each module by its path, on a line that starts with /***/.
  const modules = [...bundle.matchAll(/^\/\*{3}\/ "([^"]+)"/gm)].map((match) => match[1]);

  expect(modules.length).toBeGreaterThan(0);
  expect(modules.filter((path) => path.endsWith(".d.ts"))).toEqual([]);
});
