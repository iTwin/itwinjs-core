/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Plugin } from "vite";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Vite plugin that rewrites deep `lib/cjs/` imports to `lib/esm/` at resolve time.
 *
 * TypeScript source files import from `<pkg>/lib/cjs/...` so that type declarations
 * match the CJS build output. However, Vite browser mode cannot consume CJS named
 * exports. This plugin transparently redirects those imports to the ESM build artifacts
 * at runtime, keeping source-level TypeScript happy while giving Vite proper ESM modules.
 *
 * @param packages - Map of package name → absolute path to its workspace root.
 *   For each entry the plugin rewrites `<name>/lib/cjs/*` → `<root>/lib/esm/*.js`.
 *
 * @example
 * ```ts
 * preferEsm({
 *   "@itwin/core-frontend": path.resolve(__dirname, "../../core/frontend"),
 * })
 * ```
 */
export function preferEsm(packages: Record<string, string>): Plugin {
  // Build prefix → esmRoot lookup once
  const mappings = Object.entries(packages).map(([name, root]) => ({
    prefix: `${name}/lib/cjs/`,
    esmRoot: join(root, "lib", "esm"),
  }));

  return {
    name: "vitest-certa-bridge:prefer-esm",
    enforce: "pre",
    resolveId(id) {
      for (const { prefix, esmRoot } of mappings) {
        if (!id.startsWith(prefix))
          continue;

        const subpath = id.slice(prefix.length);
        const candidates = [
          join(esmRoot, subpath),
          join(esmRoot, `${subpath}.js`),
          join(esmRoot, subpath, "index.js"),
        ];

        for (const candidate of candidates) {
          if (existsSync(candidate))
            return candidate;
        }
      }
      return null;
    },
  };
}
