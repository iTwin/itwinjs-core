import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src/test",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/filename.test.ts"], // to honor it/describe.only
<<<<<<< HEAD
=======
    testTimeout: 80000, // Some tests can take much longer than the default 5 seconds when run in parallel.
>>>>>>> d29b1980f7 (Resolve GHSA-vjh7-7g9h-fjfh (#7716))
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
  }
})
