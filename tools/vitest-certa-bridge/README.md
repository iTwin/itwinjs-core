# @itwin/vitest-certa-bridge

Minimal foundation for running iTwin.js Electron renderer tests under Vitest.

This first stacked PR intentionally exposes only the pieces needed by `core/electron`:

- a custom Vitest browser provider at `@itwin/vitest-certa-bridge/electron-provider`
- backend callback registration from the package root

Additional package surfaces should be added in later VCB branches only when a consumer needs them.

## Electron browser provider

Use the provider from a Vitest browser-mode config. Vitest still requires each test package to define its own config because test globs, reporters, server filesystem allowlists, backend init modules, and preload modules are package-specific; the bridge cannot infer those safely as global defaults.

```ts
import * as path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
  test: {
    browser: {
      enabled: true,
      provider: "@itwin/vitest-certa-bridge/electron-provider",
      instances: [
        {
          browser: "electron",
          backendInitModule: path.resolve(__dirname, "lib/cjs/test/frontend/utils/backend.js"),
          preloadModule: path.resolve(__dirname, "lib/cjs/backend/ElectronPreload.js"),
        },
      ],
      headless: true,
      isolate: false,
      screenshotFailures: false,
    },
  },
});
```

Vitest owns browser-side collection, execution, assertions, mocks, and reporting. The provider owns only:

- spawning Electron
- creating the BrowserWindow with `nodeIntegration: false` and `contextIsolation: true`
- loading an optional backend init module in the Electron main process
- composing an optional consumer preload with the backend callback bridge
- navigating the BrowserWindow to Vitest's session URL

### Current scope

This first provider milestone supports ordinary renderer tests that use Vitest APIs such as `describe`, `it`, `expect`, and `vi`, plus application code running in an Electron BrowserWindow. It is intentionally not a full browser automation driver yet.

The not-yet-supported areas are specifically `@vitest/browser` command APIs that require provider-specific automation support, such as page locators, screenshot capture, and synthesized keyboard/mouse input. Those can be added later by implementing the corresponding Electron command bridge or a fuller Playwright/CDP adapter, but `core/electron` does not need them for the current renderer integration coverage.

The provider also starts with `supportsParallelism = false`. That keeps one Electron session active at a time while the callback bridge, preload composition, cache isolation, and teardown behavior are proven. Parallel sessions can be enabled later after adding dedicated coverage for concurrent BrowserWindows/processes and any shared backend callback state.

Test-file isolation is still controlled by Vitest browser-mode config. Vitest executes tests inside a same-origin tester iframe, so the provider loads its preload into subframes while keeping `nodeIntegration` disabled and `contextIsolation` enabled. Each consuming package should validate its own setup/teardown assumptions when enabling or changing isolation.

## Backend callbacks

Backend init modules can register callbacks from the package root:

```ts
import { registerBackendCallback } from "@itwin/vitest-certa-bridge";

registerBackendCallback("example:add", (a: number, b: number) => a + b);
```

A backend init module is optional. Downstream packages only need one when their renderer tests require package-specific Electron-main startup or backend callbacks. This package's own smoke test uses checked-in TypeScript fixtures that are compiled before the provider test runs; they are test coverage for this package, not required consumer boilerplate.

Renderer tests can call the preload-exposed bridge:

```ts
await window._CertaSendToBackend("example:add", [2, 5]);
```

The `_CertaSendToBackend` surface is currently the intentionally small compatibility bridge needed by the Electron provider smoke tests. A typed public renderer client can be added later when a migrated consumer needs it.

### Security model

The callback bridge is a privileged test-only hook, not an application RPC mechanism:

- the BrowserWindow is navigated to Vitest's local session URL;
- `nodeIntegration` remains disabled and `contextIsolation` remains enabled;
- the provider generates a random per-session token and closes over it in the generated preload;
- the Electron main process executes only callback names explicitly registered by the backend init module;
- callback registration validates the callback shape and dispatch requires the token plus an argument array;
- registered callbacks are cleared during provider-session teardown.

Do not point this provider at untrusted remote content or register broad callbacks that expose production backend capabilities.

## Build shape

The package emits both CJS and ESM:

- CJS keeps Electron main-process entrypoints and existing Rush package consumers working.
- ESM lets Vitest load the browser provider through the package export map.

The default `tsconfig.json` targets CJS because Electron launches `provider-session.js` as a main-process CommonJS file. The `build:esm` script produces the ESM sidecar output for Vitest/browser consumption.
