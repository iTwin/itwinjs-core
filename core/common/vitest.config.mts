import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import * as packageJson from "./package.json";

const includePackages: string[] = Object.entries(packageJson.peerDependencies)
  .filter(([_, version]) => version === "workspace:*")
  .map(([pkgName]) => pkgName);

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
    },
    minWorkers: 1,
    maxWorkers: 3,
  },
  optimizeDeps: {
    include: includePackages,
    force: true,
  }
})
