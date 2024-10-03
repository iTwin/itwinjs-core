import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { viteStaticCopy } from 'vite-plugin-static-copy';

const dirAssets = ["./src/public", "./src/test/public"];
export default defineConfig({
  test: {
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/<testfileName>.test.ts"], // to adhere to chai's describe.only/it.only
    browser: {
      provider: "playwright",
      enabled: true,
      name: "chromium",
      headless: true,
      screenshotFailures: false
    },
    coverage: {
      provider: "istanbul", // akin to nyc,
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
    DynamicPublicDirectory(dirAssets),
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
  // TODO: NAM INVESTIGATE THIS
  optimizeDeps: {
    include: ['@itwin/core-frontend', "@itwin/core-common", "@itwin/core-bentley"],
  },
  build: {
    commonjsOptions: {
      include: [/@itwin\/core-frontend/, /@itwin\/core-common/, /@itwin\/core-bentley/, /node_modules/],
    }
  }
})
