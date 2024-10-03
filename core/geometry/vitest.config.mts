import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src/test",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/filename.test.ts"], // to honor it/describe.only
    coverage: {
      provider: "istanbul", // akin to nyc,
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
