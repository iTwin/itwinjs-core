import { defineConfig } from 'vitest/config';
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
    DynamicPublicDirectory(dirAssets),
    viteStaticCopy({
      targets: [
        {
          src: 'lib/test/test-worker.js', // Path to the transpiled JavaScript file
          dest: '.' // Destination directory in the public folder
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
