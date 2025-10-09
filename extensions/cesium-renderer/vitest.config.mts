import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "public");
export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  publicDir,
  test: {
    dir: "src",
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
    maxWorkers: 3,
  },
  optimizeDeps: {
    force: true,
  }
})
