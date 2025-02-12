import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
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
    }
  },
  optimizeDeps: {
    include: ["@itwin/core-bentley", "@itwin/core-geometry"],
    force: true,
  }
})
