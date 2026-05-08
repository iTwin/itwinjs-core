import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test/backend",
    // Only RunElectronBackendTests has describe/it — ElectronHost.test.ts
    // exports plain objects (runs inside spawned Electron, not vitest)
    include: ["**/RunElectronBackendTests.ts"],
    testTimeout: 60000,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/backend_junit_results.xml" }],
    ],
    // These tests spawn Electron processes - they are Node.js tests, NOT browser tests
    pool: "forks",
  },
});
