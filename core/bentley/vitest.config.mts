import { coverageConfigDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
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
<<<<<<< HEAD
    }
=======
    },
    minWorkers: 1,
    maxWorkers: 3,
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      target: "es2022",
    },
>>>>>>> 7a735d806b (Security: remediate GHSA-gv7w-rqvm-qjhr (esbuild <0.28.1) (#9398))
  }
})
