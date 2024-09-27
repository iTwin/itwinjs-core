import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src",
    coverage: {
      provider: "istanbul", // akin to nyc
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
  }
})
