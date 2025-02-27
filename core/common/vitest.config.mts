import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import * as packageJson from "./package.json";

const includePackages: string[] = [];

Object.keys(packageJson.peerDependencies).forEach((pkgName) => {
  if (pkgName.startsWith("@itwin") || pkgName.startsWith("@bentley")) {
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
