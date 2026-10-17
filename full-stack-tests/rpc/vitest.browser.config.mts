import path from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { loopbackHost } from "@itwin/vitest-browser-bridge/ports";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
/** Port of the Vitest page. The global setup reads the port Vitest resolved and derives the backends from it. */
const frontendPort = 3020;

const environment = process.env.VITEST_RPC_ENVIRONMENT;
if (environment !== "http" && environment !== "websocket")
  throw new Error(`Expected VITEST_RPC_ENVIRONMENT to be "http" or "websocket", got "${environment ?? "undefined"}".`);
const isDebug = process.env.VITEST_RPC_DEBUG === "1";

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
    host: loopbackHost,
    port: frontendPort,
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
    testTimeout: isDebug ? 0 : 120000,
    hookTimeout: isDebug ? 0 : 120000,
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: `lib/test/${environment}_junit_results.xml` }],
    ],
    browser: {
      api: { host: loopbackHost, port: frontendPort, strictPort: true },
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: [
            "--disable-web-security",
            "--no-sandbox",
            ...(isDebug ? ["--remote-debugging-port=9223"] : []),
          ],
        },
      }),
      instances: [{ browser: "chromium" }],
      headless: !isDebug,
      screenshotFailures: false,
    },
  },
});
