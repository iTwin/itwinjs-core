import { defineConfig } from 'vitest/config';
import { DynamicPublicDirectory } from "vite-multiple-assets";

const dirAssets = ["./src/public", "./src/test/public"];
export default defineConfig({
  test: {
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    browser: {
      provider: "playwright",
      enabled: true,
      name: "chromium",
      headless: true
    },
    coverage: {
      provider: "istanbul", // akin to nyc,
      reporter: [
        'text'
      ]
    }
  },
  plugins: [
    DynamicPublicDirectory(dirAssets)
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
