import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import * as packageJson from "./package.json";

const includePackages: string[] = [];

Object.entries(packageJson.dependencies).forEach(([pkgName, version]) => {
  if (version === "workspace:*") {
    try {
      includePackages.push(pkgName);
    } catch (e) { }
  }
});

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src/test",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/filename.test.ts"], // to honor it/describe.only
    testTimeout: 80000, // Some tests can take much longer than the default 5 seconds when run in parallel.
    minWorkers: 1,
    maxWorkers: 3,
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
      thresholds: { // This should not be in the default config file.
        branches: 70,
        statements: 85,
        functions: 85,
        lines: 85
      }
    },
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
  },
  optimizeDeps: {
    include: includePackages,
    force: true,
  }
})
