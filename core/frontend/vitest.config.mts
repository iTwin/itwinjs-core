import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  test: {
    dangerouslyIgnoreUnhandledErrors : true,
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    browser: {
      provider: "playwright",
      enabled: true,
      name: "chromium",
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
    pool: "forks",
    fileParallelism: false // Had to disable parallel test runs due to Worker related tests timing out and not fetching properly.
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
  },
})
