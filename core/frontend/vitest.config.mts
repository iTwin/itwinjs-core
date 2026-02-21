import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { createRequire } from 'module';
import path from 'path';
import * as packageJson from "./package.json";

const require = createRequire(import.meta.url);

// Resolve test schema JSON files from node_modules (follows pnpm symlinks)
const testSchemaFiles = [
  '@bentley/units-schema/Units.ecschema.json',
  '@bentley/formats-schema/Formats.ecschema.json',
  '@bentley/aec-units-schema/AecUnits.ecschema.json',
].map((specifier) => require.resolve(specifier));

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
      provider: "playwright",
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
    viteStaticCopy({
      targets: [
        {
          src: 'lib/test/test-worker.js',
          dest: '.'
        },
        {
          src: 'lib/public/*',
          dest: '.'
        },
        {
          src: 'src/test/public/*',
          dest: '.'
        },
        // Serve EC schema JSON files for example-code tests (resolved through pnpm symlinks)
        ...testSchemaFiles.map((filePath) => ({
          src: filePath,
          dest: 'assets/schemas'
        }))
      ]
    })
  ],
  resolve: {
    alias: {
      "../../package.json": "../package.json",
    }
  },
  optimizeDeps: {
    include: includePackages,
    force: true,
  },
})
