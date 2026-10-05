import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import * as packageJson from "./package.json";

const require = createRequire(import.meta.url);

// Resolve test schema JSON files from node_modules (follows pnpm symlinks)
const testSchemaFiles = [
  '@bentley/units-schema/Units.ecschema.json',
  '@bentley/formats-schema/Formats.ecschema.json',
  '@bentley/aec-units-schema/AecUnits.ecschema.json',
].map((specifier) => require.resolve(specifier).replace(/\\/g, "/"));

const mimeTypes: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".cur": "image/x-icon",
};

/** Serves files and directories from disk at fixed URLs on the test dev server. First matching mount wins. */
function serveTestAssets(mounts: { url: string, fsPath: string }[]): Plugin {
  const resolved = mounts.map(({ url, fsPath }) => ({ url, root: path.resolve(__dirname, fsPath) }));
  return {
    name: "itwin-serve-test-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.method !== "GET" && req.method !== "HEAD") || !req.url)
          return next();

        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        for (const { url, root } of resolved) {
          let file: string;
          if (url.endsWith("/")) {
            if (!urlPath.startsWith(url))
              continue;
            file = path.resolve(root, `.${urlPath.substring(url.length - 1)}`);
            if (!file.startsWith(root + path.sep))
              continue;
          } else if (urlPath === url) {
            file = root;
          } else {
            continue;
          }

          if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile())
            continue;

          res.setHeader("Content-Type", mimeTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream");
          res.setHeader("Cache-Control", "no-cache");
          if (req.method === "HEAD")
            return res.end();
          return fs.createReadStream(file).pipe(res);
        }
        next();
      });
    },
  };
}

const includePackages: string[] = [
  ...Object.entries(packageJson.peerDependencies)
    .filter(([_, version]) => version === "workspace:*")
    .map(([pkgName]) => pkgName),
  ...Object.entries(packageJson.dependencies)
    .filter(([_, version]) => version === "workspace:*")
    .map(([pkgName]) => pkgName)
];

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/<insert-file-name-here>.test.ts"],
    browser: {
      provider: playwright(),
      enabled: true,
      instances: [
        { browser: "chromium" }
      ],
      headless: true,
      screenshotFailures: false
    },
    coverage: {
      provider: "v8",
      include: [
        "src/**/*"
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/test/**/*",
        "**/*.d.ts",
        "**/*.d.tsx"
      ],
      reporter: [
        "text-summary",
        "lcov",
        "cobertura"
      ],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
    minWorkers: 1,
    maxWorkers: 3
  },
  plugins: [
    serveTestAssets([
      { url: "/test-worker.js", fsPath: "lib/test/test-worker.js" },
      // Serve EC schema JSON files for example-code tests (resolved through pnpm symlinks)
      ...testSchemaFiles.map((filePath) => ({ url: `/assets/schemas/${path.basename(filePath)}`, fsPath: filePath })),
      { url: "/", fsPath: "lib/public" },
      { url: "/", fsPath: "src/test/public" },
    ]),
  ],
  resolve: {
    alias: {
      "../../package.json": "../package.json",
    }
  },
  optimizeDeps: {
    include: includePackages,
    force: true,
    esbuildOptions: {
      target: "es2022",
    },
  },
})
