/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";
import { certaBridge } from "@itwin/vitest-certa-bridge";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import type { Plugin } from "vite";

// Load .env so define block can read env vars
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  dotenvExpand(dotenv.config({ path: envFile }));
}

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
      backendInitModule: path.resolve(__dirname, "lib/backend/BridgeInit.js"),
    }),
    // Same null-loader patterns as webpack.config.js
    nullLoader([
      /azure-storage/,
      /AzureFileHandler/,
      /UrlFileHandler/,
      /AzureSdkFileHandler/,
      /ws\/index\.js$/,
      /tunnel\.js/,
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
    alias: {
      // Polyfill overrides matching webpack.config.js fallback section
      "assert": "assert",
      "stream": "stream-browserify",
      "zlib": "browserify-zlib",
      "path": "path-browserify",
      "http": "stream-http",
      "https": "https-browserify",
    },
  },
  optimizeDeps: {
    exclude: [
      "@itwin/core-frontend",
      "@itwin/core-common",
      "@itwin/core-bentley",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
      "@itwin/core-electron",
      "@itwin/ecschema-metadata",
      "@itwin/ecschema-rpcinterface-common",
      "@itwin/presentation-common",
      "@itwin/presentation-frontend",
      "@itwin/hypermodeling-frontend",
      "@itwin/editor-frontend",
      "@itwin/editor-common",
    ],
  },
  define: {
    // Match webpack DefinePlugin — env vars needed by test code
    "process.env.IMODELJS_CORE_DIRNAME": JSON.stringify(path.join(__dirname, "../..")),
    "process.env.IMJS_URL_PREFIX": JSON.stringify(process.env.IMJS_URL_PREFIX ?? ""),
    "process.env.FULL_STACK_BACKEND_PORT": JSON.stringify(process.env.FULL_STACK_BACKEND_PORT ?? "5010"),
  },
  server: {
    port: 3010,
    fs: {
      allow: [
        // Public asset dirs from certa.json chromeOptions.publicDirs
        "./node_modules/@itwin/hypermodeling-frontend/lib/public/",
        "./node_modules/@itwin/core-frontend/lib/public/",
        // Allow reading from parent directories for workspace packages
        "../..",
      ],
    },
  },
  test: {
    dir: "src",
    globals: true,
    testTimeout: 240000,
    fileParallelism: false,
    setupFiles: ["src/frontend/vitest.setup.ts"],
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
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
  },
});
