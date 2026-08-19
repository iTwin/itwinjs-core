# @itwin/vitest-browser-bridge

> [!WARNING]
> This package is under active development. Its APIs and behavior may change without notice.

Internal Vitest BrowserProvider infrastructure for running renderer tests in a real Electron browser runtime. The package is not a test runner and does not expose a package-root entrypoint.

The provider and browser callback exports are ESM-only. The backend callback export also supports `require` because existing backend initialization modules compile to CommonJS. CommonJS Electron session and preload files are private process-boundary artifacts, not a second public package surface.

## Vitest 4 provider

The consuming project must provide Vitest `^4.1.10` and an Electron version in the supported `>=35 <44` range. This package temporarily pins `@opentelemetry/api` 1.0.4 so its Vitest types resolve to the same peer instance as `@vitest/browser` in the current Rush graph; remove that pin when the repository aligns on Vitest's `^1.9.0` optional peer. Vitest owns test collection, execution, `describe`/`it`/`expect`/`vi`, mocks, assertions, and reporting. The provider owns only the Electron process, secure `BrowserWindow`, optional main-process initialization, bridge and consumer preload registration, and teardown.

```ts
import { electron } from "@itwin/vitest-browser-bridge/electron-provider";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: electron({
        backendInitModule: "/absolute/path/to/backend-init.js",
        preloadModule: "/absolute/path/to/consumer-preload.js",
      }),
      instances: [{ browser: "electron" }],
      headless: true,
    },
  },
});
```

The provider is registered through Vitest's `defineBrowserProvider` factory and conforms to its `BrowserProvider` contract. It does not collect tests, rewrite imports, install globals, use `require.cache`, implement custom sharding or resource monitoring, or aggregate results. Parallel sessions are disabled until concurrent-session behavior has dedicated coverage.

The optional backend initialization module is loaded once for its module-evaluation side effects; exported functions are not invoked as implicit initializers.

The provider creates a `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and `nodeIntegrationInSubFrames: true` so Vitest's tester iframe receives the consumer preload without gaining Node integration. A package-owned bridge preload is registered separately with Electron's session, so the bridge does not generate or impose a module format on the consumer preload. The provider navigates the window to the exact session URL supplied by Vitest.

This foundation intentionally does not implement Vitest browser automation commands such as locators, screenshots, keyboard, or mouse input. Tests that need those APIs should use an appropriate provider until an Electron command adapter is designed and tested.

## Callback transport

The callback surfaces are deliberately separate so browser-only code does not import Electron:

- `@itwin/vitest-browser-bridge/callbacks/backend` registers narrow test callbacks in the Electron main process and clears them during teardown.
- `@itwin/vitest-browser-bridge/callbacks/browser` invokes the preload-exposed callback bridge without importing Electron.

The IPC handler accepts requests only from the provider-owned `WebContents`. Unknown callbacks, malformed payloads, synchronous throws, and asynchronous rejections become explicit callback failures without surfacing as unhandled Electron IPC errors. Callback names remain dynamically typed for compatibility with Certa's established test-hook contract; transported arguments and results remain `unknown` at the process boundary. The transport is a test hook and is not a production RPC surface.

```ts
// Electron main-process backend init module
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";

registerBackendCallback("example:add", (a: number, b: number) => a + b);
```

```ts
// Renderer test
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";

const result = await invokeBackendCallback("example:add", 2, 5);
```

The package exports only `./electron-provider`, `./callbacks/backend`, and `./callbacks/browser`. Transport and Electron integration modules remain private implementation details, and there is intentionally no broad package-root export.
