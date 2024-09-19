import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src",
    browser: {
      provider: "playwright",
      enabled: true,
      name: "chromium"
    },
    coverage: {
      provider: "istanbul", // akin to nyc,
      reporter: [
        'text'
      ]
    }
  },
  optimizeDeps: {
    exclude: ['core-frontend']
  }
})
