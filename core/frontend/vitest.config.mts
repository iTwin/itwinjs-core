import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
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
].map((specifier) => require.resolve(specifier));

// Stage test assets into one folder served as Vite's publicDir. Later copies overwrite earlier ones.
const testPublicDir = "lib/test-public";
fs.rmSync(testPublicDir, { recursive: true, force: true });
for (const [src, dest] of [
  ["src/test/public", ""],
  ["lib/public", ""],
  ...testSchemaFiles.map((file) => [file, `assets/schemas/${path.basename(file)}`]),
  ["lib/test/test-worker.js", "test-worker.js"],
]) {
  if (fs.existsSync(src))
    fs.cpSync(src, path.join(testPublicDir, dest), { recursive: true, force: true });
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
  publicDir: testPublicDir,
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
