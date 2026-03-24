/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig } from "vitest/config";
import { certaBridge, nullLoader, preferEsm } from "@itwin/vitest-certa-bridge";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// Load .env so define block can read env vars
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  dotenvExpand(dotenv.config({ path: envFile }));
}

const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT ?? "5010");

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  plugins: [
    certaBridge({
      backendInitModule: path.resolve(__dirname, "lib/backend/BridgeInit.js"),
      backendPort,
      workspacePackages: [
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
    }),
    preferEsm({
      "@itwin/core-frontend": path.resolve(__dirname, "../../core/frontend"),
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
    include: [
      // Pre-bundle deps that Vite discovers late to avoid mid-test reload.
      "js-base64",
      "flatbuffers",
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
    globals: false,
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    globalSetup: ["src/globalSetup.ts"],
    setupFiles: ["src/frontend/vitest.setup.ts"],
    // Chrome smoke subset: non-GPU, non-integration tests that validate the HTTP/RPC path.
    // Full suite (including GPU/render/tile tests) runs in Electron mode.
    include: [
      "**/BackendAvailability.test.ts",
      "**/BlankConnection.test.ts",
      "**/BriefcaseTxns.test.ts",
      "**/Categories.test.ts",
      "**/CodeSpecs.test.ts",
      "**/ECSqlAst.test.ts",
      "**/ECSqlQuery.test.ts",
      "**/Elements.test.ts",
      "**/EmphasizeElements.test.ts",
      "**/FeatureSymbology.test.ts",
      "**/ModelState.test.ts",
      "**/PerModelCategoryVisibility.test.ts",
      "**/PrimitiveBuilder.test.ts",
      "**/SchemaLocator.test.ts",
      "**/SubCategoriesCache.test.ts",
      "**/ViewState.test.ts",
    ],
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
