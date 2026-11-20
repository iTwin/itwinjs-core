/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, it } from "vitest";

// The retained Certa runners load this Webpack bundle. Development mode names each module by
// its path, on a line that starts with /***/.
let modules: string[];
beforeAll(() => {
  const bundle = readFileSync(resolve(__dirname, "../../lib/dist/bundled-tests.js"), "utf8");
  modules = [...bundle.matchAll(/^\/\*{3}\/ "([^"]+)"/gm)].map((match) => match[1]);
  expect(modules.length).toBeGreaterThan(0);
});

// A .d.ts module means some import resolved to type declarations instead of code, and has no runtime exports.
it("bundles only executable modules for the retained Certa runners", () => {
  expect(modules.filter((path) => path.endsWith(".d.ts"))).toEqual([]);
});

// A file bundled from both lib/cjs and lib/esm exists twice, so state such as ElectronApp's is split between
// the copies: starting up through one and shutting down through the other leaves RPC uninitialized.
it("bundles each package file from only one of lib/cjs and lib/esm", () => {
  const builds = new Map<string, Set<string>>();
  for (const path of modules) {
    const match = /\/lib\/(cjs|esm)\//.exec(path);
    if (!match)
      continue;
    const file = path.replace(match[0], "/lib/*/");
    builds.set(file, (builds.get(file) ?? new Set()).add(match[1]));
  }

  expect([...builds].filter(([, found]) => found.size > 1).map(([file]) => file)).toEqual([]);
});
