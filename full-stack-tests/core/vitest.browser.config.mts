import * as fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const grep = process.env.VITEST_CORE_GREP ?? "#integration|#performance";
const invert = process.env.VITEST_CORE_GREP_INVERT !== "false";
const testNamePattern = new RegExp(invert ? `^(?!.*(?:${grep})).*$` : grep);
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

const publicDirectories = [
  path.resolve(packageRoot, "../../core/frontend/lib/public"),
  path.resolve(packageRoot, "../../core/hypermodeling/lib/public"),
];
const contentTypes: Record<string, string> = {
  ".cur": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".xml": "application/xml",
};

function serveTestPublicFiles() {
  return {
    name: "serve-core-test-public-files",
    configureServer(server: { middlewares: { use: (middleware: (request: any, response: any, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        if (request.url === undefined) {
          next();
          return;
        }

        const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        if (requestPath.includes("..")) {
          next();
          return;
        }

        for (const directory of publicDirectories) {
          const filePath = path.resolve(directory, `.${requestPath}`);
          if (!filePath.startsWith(`${directory}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
            continue;

          response.statusCode = 200;
          response.setHeader("Content-Type", contentTypes[path.extname(filePath)] ?? "application/octet-stream");
          fs.createReadStream(filePath).pipe(response);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [serveTestPublicFiles()],
  publicDir: false,
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
    host: "127.0.0.1",
    port: 3010,
    strictPort: true,
  },
  test: {
    dir: "src/frontend",
    // QueryExtents owns the performance partition; do not create tester frames for unrelated suites.
    include: !invert && grep === "#performance" ? ["**/QueryExtents.test.ts"] : ["**/*.test.ts"],
    exclude: [
      "**/app/NativeApp.test.ts",
      "**/standalone/BriefcaseConnection.test.ts",
      "**/standalone/CatalogConnection.test.ts",
      "**/standalone/ITwinError.test.ts",
      "**/standalone/OpenStandalone.test.ts",
      "**/standalone/SnapshotConnection.test.ts",
    ],
    setupFiles: [path.resolve(packageRoot, "src/frontend/vitest.setup.ts")],
    globalSetup: path.resolve(packageRoot, "src/browser-global-setup.ts"),
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
      api: { host: "127.0.0.1", port: 3010, strictPort: true },
      enabled: true,
      provider: playwright({
        launchOptions: { args: ["--disable-web-security", "--no-sandbox"] },
      }),
      instances: [{ browser: "chromium" }],
      headless: true,
      screenshotFailures: false,
    },
  },
});
