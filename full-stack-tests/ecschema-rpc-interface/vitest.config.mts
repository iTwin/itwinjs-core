/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";
import { certaBridge } from "@itwin/vitest-certa-bridge";
import path from "path";
import type { Plugin } from "vite";

// Null-loader equivalent: returns empty module for Node.js-only packages
function nullLoader(patterns: RegExp[]): Plugin {
  return {
    name: "null-loader",
    enforce: "pre",
    resolveId(id) {
      for (const pattern of patterns) {
        if (pattern.test(id)) return `\0null:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0null:")) return "export default {}; export {};";
      return null;
    },
  };
}

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  plugins: [
    certaBridge({
      backendInitModule: path.resolve(__dirname, "lib/backend/BackendInit.js"),
    }),
    nullLoader([
      /azure-storage/,
      /AzureFileHandler/,
      /UrlFileHandler/,
      /dotenv/,
    ]),
  ],
  resolve: {
    dedupe: [
      "@itwin/core-frontend",
      "@itwin/core-common",
      "@itwin/core-bentley",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
    ],
  },
  optimizeDeps: {
    exclude: [
      "@itwin/core-frontend",
      "@itwin/core-common",
      "@itwin/core-bentley",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
      "@itwin/ecschema-metadata",
      "@itwin/ecschema-rpcinterface-common",
      "@itwin/presentation-common",
      "@itwin/presentation-frontend",
    ],
  },
  test: {
    dir: "src",
    testTimeout: 90000,
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            args: ["--disable-web-security", "--no-sandbox"],
          },
        },
      ],
      headless: true,
      screenshotFailures: false,
    },
    reporters: [
      "default",
      ["junit", { outputFile: "ecschema-rpcinterface-tests-result/ecschema-rpcinterface-tests-result.xml" }],
    ],
  },
});
