/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Plugin } from "vite";

/**
 * Vite plugin that returns an empty module for imports matching the given patterns.
 * Equivalent to webpack's null-loader — use it to stub Node.js-only packages
 * (e.g., azure-storage, ws, tunnel) that are referenced by shared code but
 * unused in the browser.
 *
 * @example
 * ```ts
 * nullLoader([/azure-storage/, /ws\/index\.js$/, /dotenv/])
 * ```
 */
export function nullLoader(patterns: RegExp[]): Plugin {
  return {
    name: "vitest-certa-bridge:null-loader",
    enforce: "pre",
    resolveId(id) {
      for (const pattern of patterns) {
        if (pattern.test(id))
          return `\0null:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0null:"))
        return "export default {}; export {};";
      return null;
    },
  };
}
