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
  // Serve static assets (worker scripts, locales, sprites) collected by the
  // copy:assets build step into lib/public/. See scripts/copy-public-assets.js.
  publicDir: path.resolve(__dirname, "lib/public"),
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
      // Pre-bundle transitive deps that Vite discovers late to avoid mid-test
      // reload which kills in-progress test suites (e.g. ECSqlAst).
      // @see package.json devDependencies — these must be declared explicitly
      // for Rush phantom prevention to allow resolution.
      "js-base64",
      "flatbuffers",
      "fuse.js",
      "@loaders.gl/draco",
      "wms-capabilities",
      "i18next",
      "i18next-browser-languagedetector",
      "i18next-http-backend",
    ],
  },
  define: {
    // Match webpack DefinePlugin — expose test env vars to browser code.
    // In Vitest browser mode, `process.env.X` is replaced at compile time by Vite's define block.
    // Without this, browser code that reads process.env gets undefined.
    "process.env.IMODELJS_CORE_DIRNAME": JSON.stringify(path.join(__dirname, "../..")),
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => key.startsWith("IMJS_") || key.startsWith("FULL_STACK_") || key.startsWith("TEST_"))
        .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value ?? "")])
    ),
  },
  server: {
    port: 3010,
    host: "127.0.0.1",
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
    // One automatic retry for transient browser/IPC flakes. Real regressions fail
    // consistently across retries; transient network/timing hiccups get one free
    // pass. Mirrors the Electron runner's shard-level retry behavior for parity.
    retry: process.env.CI ? 1 : 0,
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
            args: [
              "--disable-web-security",
              "--no-sandbox",
              "--ignore-gpu-blocklist",
            ],
          },
        },
      ],
      headless: true,
      screenshotFailures: false,
    },
    // Stream browser console output to CI logs for debugging hangs/timeouts.
    onConsoleLog() {
      // default behavior (return undefined) prints to stdout
    },
    reporters: [
      "verbose",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
  },
});
