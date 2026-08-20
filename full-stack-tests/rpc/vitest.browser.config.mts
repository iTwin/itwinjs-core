import path from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

const environment = process.env.VITEST_RPC_ENVIRONMENT;
if (environment !== "http" && environment !== "websocket")
  throw new Error(`Expected VITEST_RPC_ENVIRONMENT to be "http" or "websocket", got "${environment ?? "undefined"}".`);

export default defineConfig({
  define: { "process.env.VITEST_RPC_ENVIRONMENT": JSON.stringify(environment) },
  esbuild: { target: "es2022" },
  resolve: {
    alias: {
      "@itwin/core-mobile/lib/cjs/MobileFrontend": path.resolve(packageRoot, "../../core/mobile/src/MobileFrontend.ts"),
    },
  },
  optimizeDeps: {
    force: true,
    include: [
      "@itwin/core-bentley",
      "@itwin/core-common",
      "@itwin/core-frontend",
    ],
    exclude: ["electron"],
    esbuildOptions: { target: "es2022" },
  },
  server: {
    host: "127.0.0.1",
    port: 3020,
    strictPort: true,
  },
  test: {
    dir: "src/frontend",
    include: ["**/*.test.ts"],
    exclude: [
      "**/Rpc.ElectronProtocol.test.ts",
      ...(environment === "http"
        ? ["**/IpcInvoke.test.ts"]
        : ["**/Mobile.test.ts", "**/Routing.test.ts", "**/security.test.ts"]),
    ],
    setupFiles: [path.resolve(packageRoot, "src/frontend/vitest.browser.setup.ts")],
    globalSetup: path.resolve(packageRoot, "src/browser-global-setup.ts"),
    globals: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
    browser: {
      api: { host: "127.0.0.1", port: 3020, strictPort: true },
      enabled: true,
      provider: playwright({
        launchOptions: { args: ["--disable-web-security", "--no-sandbox"] },
      }),
      instances: [{ browser: "chromium" }],
      headless: true,
      screenshotFailures: false,
    },
  },
});
