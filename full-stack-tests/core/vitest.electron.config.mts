/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { electron } from "@itwin/vitest-browser-bridge/electron-provider";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
const envResult = dotenv.config({ path: path.join(packageRoot, ".env") });
if (!envResult.error)
  dotenvExpand(envResult);
const testEnvironment = Object.fromEntries(
  Object.entries(process.env)
    .filter(([key, value]) => value !== undefined && /^(IMJS_|TEST_|ITWINJS_)/.test(key)),
);
const define: Record<string, string> = {
  "process.env.IMODELJS_CORE_DIRNAME": JSON.stringify(path.resolve(packageRoot, "../..")),
};
for (const [key, value] of Object.entries(testEnvironment))
  define[`process.env.${key}`] = JSON.stringify(value);
const grep = process.env.VITEST_CORE_GREP ?? "#integration|#performance";
const invert = process.env.VITEST_CORE_GREP_INVERT !== "false";
const testNamePattern = new RegExp(invert ? `^(?!.*(?:${grep})).*$` : grep);

export default defineConfig({
  define,
  resolve: {
    alias: [
      {
        find: "path",
        replacement: require.resolve("path-browserify"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/test-support",
        replacement: path.resolve(packageRoot, "../../core/frontend/lib/esm/internal/test-support.js"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/render/MockRender",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredMockRender.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/webgl",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredWebgl.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/render/PrimitiveBuilder",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredPrimitiveBuilder.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/tile/IModelTileTree",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredIModelTileTree.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/tile/DynamicIModelTile",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredDynamicIModelTile.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/internal/tile/ThreeDTileFormatInterpreter",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredThreeDTileFormatInterpreter.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/common/imdl/ParseImdlDocument",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredParseImdlDocument.mjs"),
      },
      {
        find: "@itwin/core-frontend/lib/cjs/common/internal/render/SurfaceParams",
        replacement: path.resolve(packageRoot, "src/frontend/DeferredSurfaceParams.mjs"),
      },
      {
        find: /^@itwin\/core-frontend\/lib\/cjs\//,
        replacement: `${path.resolve(packageRoot, "../../core/frontend/lib/esm")}/`,
      },
      {
        find: "@itwin/core-frontend",
        replacement: path.resolve(packageRoot, "../../core/frontend/lib/esm/core-frontend.js"),
      },
      {
        find: "@itwin/core-electron/lib/cjs/frontend/ElectronApp",
        replacement: path.resolve(packageRoot, "../../core/electron/src/frontend/ElectronApp.ts"),
      },
      {
        find: "../../package.json",
        replacement: path.resolve(packageRoot, "../../core/frontend/package.json"),
      },
    ],
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    force: true,
    include: [
      "@itwin/core-bentley",
      "@itwin/core-common",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
      "@itwin/ecschema-metadata",
      "@itwin/ecschema-rpcinterface-common",
      "@itwin/editor-common",
    ],
    exclude: ["electron", "@itwin/imodels-access-frontend", "@itwin/electron-authorization/Renderer"],
    esbuildOptions: {
      target: "esnext",
      alias: {
        "@itwin/core-frontend": path.resolve(packageRoot, "../../core/frontend/lib/esm/core-frontend.js"),
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(packageRoot, "../.."), path.resolve(packageRoot, "../../core/electron")],
    },
  },
  test: {
    dir: "src/frontend",
    include: ["**/*.test.ts"],
    exclude: [
      "**/Backend.test.ts",
      "**/map/BackgroundMap.test.ts",
      "**/map/PlanProjection.test.ts",
      "**/map/PlanarClipMask.test.ts",
      "**/standalone/BlankConnection.test.ts",
      "**/standalone/Categories.test.ts",
      "**/standalone/CodeSpecs.test.ts",
      "**/standalone/ECSqlAst.test.ts",
      "**/standalone/Elements.test.ts",
      "**/standalone/ModelState.test.ts",
      "**/standalone/SchemaLocator.test.ts",
      "**/standalone/SubCategoriesCache.test.ts",
      "**/standalone/ViewState.test.ts",
    ],
    setupFiles: [path.resolve(packageRoot, "src/frontend/vitest.setup.ts")],
    globals: true,
    testNamePattern,
    testTimeout: 240000,
    hookTimeout: 240000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
    browser: {
      enabled: true,
      provider: electron({
        backendInitModule: path.resolve(packageRoot, "lib/backend/vitest-electron.js"),
        preloadModule: path.resolve(packageRoot, "../../core/electron/lib/cjs/backend/ElectronPreload.js"),
      }),
      instances: [{ browser: "electron" }],
      headless: true,
      screenshotFailures: false,
    },
  },
});
