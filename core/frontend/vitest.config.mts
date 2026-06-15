import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
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
    pool: "threads",
    fileParallelism: false
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
<<<<<<< HEAD
    include: ["@itwin/core-common", "@itwin/core-bentley", "@itwin/core-geometry", "@itwin/core-quantity", "@itwin/appui-abstract", "@itwin/core-orbitgt"],
=======
    include: includePackages,
    force: true,
    esbuildOptions: {
      target: "es2022",
    },
>>>>>>> 7a735d806b (Security: remediate GHSA-gv7w-rqvm-qjhr (esbuild <0.28.1) (#9398))
  },
})
