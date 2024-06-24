import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test",
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
  },
  // optimizeDeps: {},
});
