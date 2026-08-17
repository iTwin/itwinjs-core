# @itwin/vitest-browser-bridge

Internal Vitest BrowserProvider infrastructure for running renderer tests in a real Electron browser runtime. The package is not a test runner and does not expose a package-root entrypoint.

## Vitest 4 provider

Vitest owns test collection, execution, `describe`/`it`/`expect`/`vi`, mocks, assertions, and reporting. The provider owns only the Electron process, secure `BrowserWindow`, optional main-process initialization, preload composition, and teardown.

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

The provider implements Vitest 4's `BrowserProvider` interface directly. It does not collect tests, rewrite imports, install globals, use `require.cache`, implement custom sharding or resource monitoring, or aggregate results. Parallel sessions are disabled until concurrent-session behavior has dedicated coverage.

The provider creates a `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and `nodeIntegrationInSubFrames: true` so Vitest's tester iframe receives the preload without gaining Node integration. It navigates the window to the exact session URL supplied by Vitest.

This foundation intentionally does not implement Vitest browser automation commands such as locators, screenshots, keyboard, or mouse input. Tests that need those APIs should use an appropriate provider until an Electron command adapter is designed and tested.

## Callback transport

The callback surfaces are deliberately separate so browser-only code does not import Electron:

- `@itwin/vitest-browser-bridge/callbacks/protocol` contains validation and transport response types with no platform imports.
- `@itwin/vitest-browser-bridge/callbacks/backend` registers narrow test callbacks in the Electron main process and clears them during teardown.
- `@itwin/vitest-browser-bridge/callbacks/browser` invokes the preload-exposed callback bridge without importing Electron.
- `@itwin/vitest-browser-bridge/callbacks/electron` composes the consumer preload and installs the token-validated Electron IPC handler.

The callback request contains an explicit method, callback name, argument array, and a random token generated for each provider session. Unknown callbacks, malformed payloads, wrong tokens, synchronous throws, and asynchronous rejections become structured failures. The transport is a test hook and is not a production RPC surface.

```ts
// Electron main-process backend init module
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";

registerBackendCallback("example:add", (a: number, b: number) => a + b);
```

```ts
// Renderer test
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";

const result = await invokeBackendCallback("example:add", [2, 5]);
```

The package exports only `./electron-provider`, `./callbacks/protocol`, `./callbacks/backend`, `./callbacks/browser`, and `./callbacks/electron`. There is intentionally no broad package-root export.
