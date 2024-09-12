import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    dir: "src/test",
    coverage: {
      provider: "istanbul", // akin to nyc,
      reporter: [
        'text'
      ],
      thresholds: {
        
      }
    },
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
  }
})
