import { coverageConfigDefaults, defineConfig } from "vitest/config";
export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    include: ["**/CesiumSystem.test.ts"],
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
    maxWorkers: 3,
  },
  optimizeDeps: {
    force: true,
  }
})
