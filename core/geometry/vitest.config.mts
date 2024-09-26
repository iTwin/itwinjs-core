import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src/test",
    setupFiles: "./src/test/setupTests.ts",
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
        'text'
      ],
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
