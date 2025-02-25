import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    browser: {
      provider: "playwright",
      enabled: true,
      instances : [
        { browser: "chromium"}
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
    maxWorkers: 3
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'lib/test/test-worker.js',
          dest: '.'
        },
        {
          src: 'lib/public/*',
          dest: '.'
        },
        {
          src: 'src/test/public/*',
          dest: '.'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      "../../package.json": "../package.json",
    }
  },
  optimizeDeps: {
    include: ["@itwin/core-common", "@itwin/core-bentley", "@itwin/core-geometry", "@itwin/core-quantity", "@itwin/appui-abstract", "@itwin/core-orbitgt"],
    force: true,
  },
})
