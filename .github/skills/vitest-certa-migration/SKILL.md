---
name: vitest-certa-migration
description: Migrate iTwin.js packages from Certa + Mocha + webpack to Vitest browser mode with the vitest-certa-bridge plugin for backend callbacks.
---

# Migrating from Certa to Vitest

This skill covers migrating iTwin.js packages that use `@itwin/certa` (Mocha-based browser/Electron test runner with webpack bundling) to Vitest browser mode with Playwright. Packages that need backend↔frontend callback bridging use the `@itwin/vitest-certa-bridge` plugin.

## Three Migration Scenarios

### Scenario A: Browser-only tests (no backend callbacks)

Packages whose tests run entirely in the browser with no `registerBackendCallback` / `executeBackendCallback` usage and no `backendInitModule` in `certa.json`.

Examples: `core/i18n`, `core/markup`, `core/webgl-compatibility`, `core/hypermodeling`, `ui/appui-abstract`, `extensions/frontend-tiles`

### Scenario B: Full-stack tests with backend bridge

Packages that register Node.js-side callbacks and invoke them from browser-side test code. Identified by:
- `backendInitModule` in `certa.json`
- Imports from `@itwin/certa/lib/utils/CallbackUtils`

Examples: `full-stack-tests/core` (Chrome mode), `full-stack-tests/rpc`, `full-stack-tests/rpc-interface`, `full-stack-tests/ecschema-rpc-interface`

### Scenario C: Electron renderer tests

Packages whose tests run inside a real Electron `BrowserWindow` renderer process. These tests exercise Electron-specific APIs (`ElectronApp`, `NativeApp`, `IpcApp`) and need `nodeIntegration: true` with access to Electron's IPC.

Two sub-patterns exist:
- **C1: Main-process tests** — test code runs in Electron's main process (no DOM). Use Vitest `pool: "forks"` + spawn Electron per test. Already solved by `core/electron/vitest.config.mts`.
- **C2: Renderer tests** — test code runs in a `BrowserWindow` renderer with DOM access. Need a custom harness that spawns Electron, creates BrowserWindow, loads test code, and reports results. Backend callbacks (if needed) use async IPC via `@itwin/vitest-certa-bridge/electron-main`.

Examples: `core/electron` (frontend tests), `full-stack-tests/core` (Electron mode)

## Step-by-Step Migration

### 1. Identify the scenario

Check the package's `certa.json` for `backendInitModule` and grep source files for `@itwin/certa/lib/utils/CallbackUtils`. If either exists → Scenario B. Otherwise → Scenario A.

### 2. Remove old infrastructure

Delete these files (if they exist):
- `certa.json`
- Webpack test config (typically `src/test/utils/webpack.config.js` or `webpack.config.js`)

### 3. Update package.json

#### Remove dependencies

Remove from `dependencies` and `devDependencies`:
- `@itwin/certa`
- `@types/chai`, `@types/chai-as-promised`, `@types/mocha`
- `chai`, `chai-as-promised`
- `mocha`
- `sinon`, `sinon-chai`, `@types/sinon`, `@types/sinon-chai` (replace with `vi.fn()` / `vi.spyOn()`)
- `babel-loader`, `babel-plugin-istanbul` (Vitest has built-in coverage)
- `source-map-loader` (Vitest/esbuild handles sourcemaps)
- `webpack`, `webpack-cli`
- `null-loader`
- `assert`, `browserify-zlib`, `path-browserify`, `stream-browserify`, `tty-browserify` (webpack polyfills)

#### Add dependencies

Add to `devDependencies`:
```json
{
  "vitest": "^3.0.6",
  "@vitest/browser": "^3.0.6",
  "@vitest/coverage-v8": "^3.0.6",
  "playwright": "~1.56.1"
}
```

**Scenario B only** — also add:
```json
{
  "@itwin/vitest-certa-bridge": "workspace:*"
}
```

#### Update scripts

```json
{
  "build": "npm run -s build:cjs && npm run -s build:esm",
  "test": "vitest run",
  "test:debug": "vitest --inspect-brk",
  "cover": "vitest run --coverage"
}
```

Remove: `webpack:test`, `test:chrome`, `test:electron`, `webpackTests` scripts. Remove the `&& npm run -s webpack:test` from the build script.

### 4. Create vitest.config.mts

#### Scenario A — Browser-only

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    testTimeout: 10000, // match the old certa.json mochaOptions.timeout
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            // Only keep these if the package actually needs them (e.g., cross-origin fetch in tests).
            // Many packages inherited these from certa defaults without needing them.
            args: ["--disable-web-security", "--no-sandbox"],
          },
        },
      ],
      headless: true,
      screenshotFailures: false,
    },
    coverage: {
      include: ["src/**/*"],
      exclude: ["src/test/**/*", "**/*.d.ts"],
      reporter: ["text-summary", "lcov", "cobertura"],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
  },
  // If the package served static files via certa's publicDirs:
  publicDir: "src/test/public",
});
```

#### Scenario B — With backend bridge

```typescript
import { defineConfig } from "vitest/config";
import { certaBridge } from "@itwin/vitest-certa-bridge";
import path from "path";
import type { Plugin } from "vite";

// Null-loader equivalent: returns empty module for Node.js-only packages
function nullLoader(patterns: RegExp[]): Plugin {
  return {
    name: "null-loader",
    enforce: "pre",
    resolveId(id) {
      for (const pattern of patterns) {
        if (pattern.test(id)) return `\0null:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0null:")) return "export default {}; export {};";
      return null;
    },
  };
}

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  plugins: [
    certaBridge({
      // Path to the backend init module — same value as certa.json's backendInitModule
      backendInitModule: path.resolve(__dirname, "lib/backend/BackendInit.js"),
    }),
    // Replicate any null-loader entries from the old webpack config
    nullLoader([/azure-storage/, /AzureFileHandler/, /UrlFileHandler/]),
  ],
  test: {
    dir: "src",
    testTimeout: 90000,
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            args: ["--disable-web-security", "--no-sandbox"],
          },
        },
      ],
      headless: true,
      screenshotFailures: false,
    },
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/junit_results.xml" }],
    ],
  },
});
```

### 5. Update test source imports

#### Test framework imports

Replace Mocha globals and Chai assertions with Vitest:

```diff
- import { assert, expect } from "chai";
- import * as sinon from "sinon";
+ import { assert, expect, describe, it, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
```

Key renames:
- `before()` → `beforeAll()`
- `after()` → `afterAll()`
- `sinon.stub()` / `sinon.spy()` → `vi.fn()` / `vi.spyOn()`
- `sinon.restore()` → `vi.restoreAllMocks()`
- `chai.expect(...).to.be.rejectedWith()` → `expect(...).rejects.toThrow()`

#### Backend callback imports (Scenario B only)

Replace the old deep import with direct imports from the bridge package:

**Backend code** (Node.js side — registers callbacks):
```diff
- import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
+ import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
```

**Frontend code** (browser side — invokes callbacks):
```diff
- import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
+ import { executeBackendCallback } from "@itwin/vitest-certa-bridge/client";
```

**Shared/common code** that uses both (split into separate imports):
```diff
- import { executeBackendCallback, registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
+ import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
+ import { executeBackendCallback } from "@itwin/vitest-certa-bridge/client";
```

The split is important: `registerBackendCallback` runs in Node.js (server-side), while `executeBackendCallback` runs in the browser and calls the backend via HTTP through the Vite dev server middleware.

**⚠️ CRITICAL:** In code that gets bundled for the browser (including "common" files imported by frontend tests), do NOT import from the main entry point (`@itwin/vitest-certa-bridge`). It re-exports the Vite plugin which imports Node.js built-ins (`path`, `url`) and will crash in the browser. Use `@itwin/vitest-certa-bridge/callbackRegistry` or `@itwin/vitest-certa-bridge/client` instead — these have no Node.js dependencies.

### 6. Handle public directories / static assets

Certa's `chromeOptions.publicDirs` served static files to the browser. In Vitest:

- **Simple case:** Set `publicDir` in vitest.config.mts
- **Complex case** (e.g., files in nested paths like `locales/*.json`): Write a small Vite plugin with `configureServer` middleware that intercepts requests and serves from the correct path. See `core/i18n/vitest.config.mts` for an example.

### 7. Update approved packages

If the package wasn't previously using Vitest/Playwright, add entries to `common/config/rush/browser-approved-packages.json` for:
- `vitest`
- `@vitest/browser`
- `@vitest/coverage-v8`
- `playwright`
- `@itwin/vitest-certa-bridge` (Scenario B)

Use the package's existing review category.

### 8. Validate

```bash
cd <package-dir>
rushx build    # Should no longer include webpack:test
rushx test     # Runs vitest in browser mode
rushx cover    # Runs vitest with coverage
```

**Scenario B only** — integration tests must have a `test:integration` script that starts the backend RPC server before running Vitest. This is critical because the backend (e.g., `BackendInit.js`) must be running to serve RPC requests and provide the bridge callbacks. Running `vitest run` alone will fail with connection errors since no backend is listening.

```json
{
  "test:integration": "node lib/backend/StartBackend.js & vitest run && kill $!"
}
```

The exact script varies per package — check the existing `test:chrome` or `test:electron` scripts for how the backend was previously started. The acceptance criteria is:

- `rushx test:integration` starts the backend, runs all browser tests to completion, and exits cleanly
- All bridge callbacks (`getEnv`, `getToken`, etc.) resolve successfully
- No `403` or `Server connection error` failures

### 9. Evaluate test redundancy and skip unnecessary runs

After migration, explicitly audit which tests need to run in which environment. The goal is to **avoid running the same test twice in both Chrome and Electron when one environment is sufficient**, and to **replace live backend dependencies with local mocks where possible**.

#### Chrome vs Electron overlap

Many test suites run in both Chrome (Playwright) and Electron. After migration, evaluate each suite:

| Test category | Preferred environment | Rationale |
|---|---|---|
| DOM/rendering (WebGL, tiles, viewport) | **Electron only** — GPU path is real; Chrome headless uses SwiftShader anyway | Chrome headless and Electron SwiftShader produce equivalent pixel results. Running in both just doubles CI time. |
| RPC/IPC/networking (BlankConnection, BriefcaseTxns) | **Chrome only** — exercises the HTTP/WebSocket path that web apps use | Electron IPC is a separate code path tested by `core/electron`. No need to also test HTTP bridging in Electron. |
| Pure logic (geometry, schema, formatting) | **Node.js Vitest** (`pool: "forks"`) — no browser needed | Fastest possible execution. If the test doesn't touch DOM or browser APIs, don't pay the browser startup cost. |
| Electron-specific APIs (ElectronApp, NativeApp, IpcApp) | **Electron only** — these APIs don't exist in Chrome | Self-evident. |

**How to skip:** Use `describe.skipIf` or `describe.runIf` with `ProcessDetector`:

```typescript
import { ProcessDetector } from "@itwin/core-bentley";

// Only run GPU rendering tests in Electron (Chrome headless uses same SwiftShader path)
describe.skipIf(ProcessDetector.isElectronAppFrontend)("GPU Rendering", () => { ... });

// Only run in Chrome — Electron IPC has its own dedicated test suite
describe.runIf(!ProcessDetector.isElectronAppFrontend)("HTTP Bridge", () => { ... });
```

When you skip a test from one environment, **document the justification** in the Sacrifices folder (`/Users/hoangnamle/Documents/Obsidian Vault/Vitest/Vitest Certa/Sacrifices`) so the team understands why coverage appears reduced.

#### Replace live backend dependencies with Azurite / local mocks

Integration tests that connect to remote iTwin Platform services (IMS auth, iModel Hub, Reality Data) are:
- **Slow** — network roundtrips add 5-30s per test
- **Flaky** — dependent on service availability, token expiry, rate limits
- **Credential-bound** — require `IMJS_*` secrets that not all CI agents have

**Strategy:** Use [Azurite](https://github.com/Azure/Azurite) and proper mocking to eliminate live backend dependencies wherever the test's purpose is to validate *client-side logic*, not the remote service itself.

| Dependency | Local replacement | When to use |
|---|---|---|
| Azure Blob Storage (iModel downloads, changesets) | **Azurite** — already used in `full-stack-tests/core` via `globalSetup.ts` | Any test that reads/writes blobs. Azurite runs in-process, zero network latency. |
| IMS / OIDC authentication | **Static test token** via `registerBackendCallback("getAccessToken", ...)` returning a pre-generated token, or mock the `AuthorizationClient` interface | Tests that just need *an* auth header, not actual IMS validation. |
| iModel Hub REST APIs | **Mock HTTP server** (e.g., `msw` or a simple Express stub) returning canned JSON responses | Tests validating client-side response parsing, error handling, retry logic. |
| Reality Data API | **Local fixture files** + mock fetch | Tests rendering reality meshes — the mesh data can be served from `public/` static assets. |

**When NOT to mock:** Keep live backend connections for:
- Smoke tests explicitly tagged `#integration` that validate end-to-end auth flows
- Tests that verify wire-format compatibility (RPC serialization, changeset format)
- Performance benchmarks that measure real network latency

**Tagging convention:** Use grep-based tags to separate mocked vs live tests:

```typescript
describe("#integration Real Hub Connection", () => { ... });  // needs live backend
describe("Changeset Parsing (mocked)", () => { ... });         // runs with Azurite/mocks
```

Then in CI:
```bash
# Fast CI (mocked only, default):
rushx test

# Integration CI (live backends, scheduled/manual):
VITEST_ELECTRON_GREP="#integration" VITEST_ELECTRON_INVERT=false rushx test:integration
```

This keeps the default `rushx test` fast (< 2 min) while the full integration suite runs on a schedule or before release.

## Common Patterns

### Null-loader for Node.js-only modules

When browser tests import modules that transitively pull in Node.js-only packages (azure-storage, dotenv, ws, etc.), use the `nullLoader` Vite plugin pattern shown above. Check the old webpack config's `null-loader` rules for which patterns to include.

### JUnit reporter path

Match the old certa.json `mochaOptions.reporterOptions.mochaFile` path in the Vitest JUnit reporter config so CI pipelines don't need updating.

### Mocha-only tests to Node.js Vitest (no browser)

For packages with backend-only tests that used Mocha directly (not via Certa), use Vitest in Node.js mode:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test",
    include: ["**/*.test.ts"],
    pool: "forks",
    testTimeout: 60000,
    reporters: ["default", ["junit", { outputFile: "lib/test/junit_results.xml" }]],
  },
});
```

## Known Gotchas & Solutions

### 1. ESM file extension resolution

**Problem:** The bridge package emits dual CJS/ESM builds. Node.js ESM requires `.js` extensions on relative imports (`from "./plugin.js"`), but TypeScript with `moduleResolution: "node"` emits extensionless imports (`from "./plugin"`). When Vitest loads the plugin at startup (via native Node.js ESM), it fails with `ERR_MODULE_NOT_FOUND`.

**Solution:** Add `.js` extensions to all relative imports in the bridge package's TypeScript source files. TypeScript accepts these even with `moduleResolution: "node"` — it maps `./foo.js` back to `./foo.ts` during compilation and passes the `.js` through to the output.

### 2. CJS/ESM dual-package hazard (callback registry)

**Problem:** The `backendInitModule` is compiled CJS (`lib/backend/BackendInit.js`). When it `require()`s `@itwin/vitest-certa-bridge/callbackRegistry`, Node resolves to `lib/cjs/callbackRegistry.js`. But the bridge plugin itself runs as ESM (`lib/esm/plugin.js`) and imports `lib/esm/callbackRegistry.js`. These are **two separate module instances** with separate `callbacks` maps. Callbacks registered from CJS are invisible to the ESM plugin.

**Solution:** Use `Symbol.for("@itwin/vitest-certa-bridge/callbacks")` as the registry key on `globalThis` instead of a module-local variable. Both CJS and ESM instances read/write the same `globalThis` slot via the well-known symbol, eliminating the dual-instance problem across any number of module copies.

### 3. TypeScript subpath exports with `moduleResolution: "node"`

**Problem:** The bridge package uses `package.json` `"exports"` field for subpath imports (`@itwin/vitest-certa-bridge/client`). However, the repo's base `tsconfig-base.json` uses `"moduleResolution": "node"` which does **not** support the `exports` field. TypeScript reports `TS2307: Cannot find module`.

**Solution:** Add `"typesVersions"` to the bridge's `package.json`:
```json
"typesVersions": {
  "*": {
    "client": ["lib/cjs/client.d.ts"],
    "callbackRegistry": ["lib/cjs/callbackRegistryPublic.d.ts"]
  }
}
```
This is the standard workaround for supporting subpath exports with older `moduleResolution` settings. No consumer tsconfig changes needed.

### 4. Duplicate `@itwin/core-frontend` imports (Vite pre-bundling)

**Problem:** External npm packages (e.g., `@itwin/imodels-access-frontend`) get pre-bundled by Vite into `node_modules/.vite/deps/`, which bundles their own copy of `@itwin/core-frontend` inside them. But workspace packages resolve `@itwin/core-frontend` directly from the monorepo source. This creates duplicate instances, and `core-frontend` throws `Multiple @itwin/core-frontend imports detected!`.

**Solution:** Add both `resolve.dedupe` and `optimizeDeps.exclude` for workspace packages in the vitest config:
```typescript
resolve: {
  dedupe: [
    "@itwin/core-frontend",
    "@itwin/core-common",
    "@itwin/core-bentley",
    // ... other workspace packages
  ],
},
optimizeDeps: {
  exclude: [
    "@itwin/core-frontend",
    "@itwin/core-common",
    "@itwin/core-bentley",
    // ... other workspace packages
  ],
},
```
`resolve.dedupe` ensures all imports resolve to the same copy. `optimizeDeps.exclude` prevents Vite from bundling these into `.vite/deps/` where they'd create duplicates.

### 5. Node.js built-ins in browser bundle (plugin import graph)

**Problem:** If browser-side test code (e.g., `SideChannels.ts`) imports `registerBackendCallback` from the main entry point (`@itwin/vitest-certa-bridge`), Vite follows the import graph and pulls in `plugin.ts` which imports Node.js built-ins (`path`, `url`). This crashes in the browser with `Module "path" has been externalized for browser compatibility`.

**Solution:** Browser-side code must NOT import from the main entry point. Instead, import from the leaf subpaths that have no Node.js dependencies:
```typescript
// ✅ Safe for browser bundling — no Node.js deps in the import graph
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { executeBackendCallback } from "@itwin/vitest-certa-bridge/client";

// ❌ Pulls in plugin.ts → path, url → crashes in browser
import { registerBackendCallback } from "@itwin/vitest-certa-bridge";
```
The main entry (`@itwin/vitest-certa-bridge`) is only for vitest.config.mts (Node.js context).

### 6. External packages using `window._CertaSendToBackend`

**Problem:** Some external packages (e.g., `@itwin/oidc-signin-tool`) use Certa's browser global `window._CertaSendToBackend(name, args)` to invoke backend callbacks. This function was injected by Certa's browser runner. Without it, these packages throw `TypeError: window._CertaSendToBackend is not a function`.

**Solution:** The bridge plugin injects `window._CertaSendToBackend` via Vite's `transformIndexHtml` hook, redirecting calls to the `/__certa_bridge` HTTP endpoint. This happens automatically when using the `certaBridge()` plugin — no consumer action needed. External packages work without modification.

### 7. Legacy `"getToken"` callback for `@itwin/oidc-signin-tool` compat

**Problem:** `@itwin/oidc-signin-tool`'s `getAccessTokenFromBackend` and `getServiceAuthTokenFromBackend` helpers call `executeBackendCallback("getToken", ...)` and `executeBackendCallback("getServiceAuthToken", ...)` using the old Certa callback name. Many packages relied on a side-effect import:

```typescript
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";
```

That module registers `"getToken"` via `@itwin/certa`'s `CallbackUtils.registerBackendCallback` — i.e., into Certa's registry, not the bridge's. Under vitest-certa-bridge the frontend request routes to the bridge's HTTP middleware, which looks up the bridge's registry — and finds nothing. Result: `Error: Unknown certa backend callback "getToken"`.

**Solution:** In `BackendInit.ts`, remove the oidc-signin-tool side-effect import and register the callbacks explicitly in the bridge registry:

```typescript
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { TestUtility } from "@itwin/oidc-signin-tool/lib/cjs/TestUtility";

registerBackendCallback("getToken", async (user: any, oidcConfig?: any) => {
  if (oidcConfig === undefined || oidcConfig === null)
    return TestUtility.getAccessToken(user);
  return TestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken();
});
```

Add `"getServiceAuthToken"` similarly if the package uses `getServiceAuthTokenFromBackend`.

### 8. Vite dependency discovery reloading

**Problem:** On first run, Vite discovers transitive dependencies (e.g., `js-base64`, `flatbuffers`, `fuse.js`) that need pre-bundling. It reloads the page mid-test, causing a warning: `Vite unexpectedly reloaded a test`. Tests still pass but the warning is noisy.

**Mitigation:** This is cosmetic and doesn't affect correctness. The dependencies are cached in `node_modules/.vite/` after the first run, so subsequent runs are clean. To suppress the warning, you can add discovered deps to `optimizeDeps.include` — but only if they're direct dependencies of the package (transitive deps may fail to resolve).

## Remaining Certa Consumers

These packages still use `@itwin/certa` and need migration (in suggested order):

| Package | Scenario | Complexity | Notes |
|---------|----------|------------|-------|
| `core/markup` | A | Low | 2s timeout, unit tests only |
| `core/webgl-compatibility` | A | Low | 2s timeout, minimal deps |
| `ui/appui-abstract` | A | Medium | Has sinon/sinon-chai to migrate |
| `core/hypermodeling` | A | Medium | Serves multiple public dirs |
| `extensions/frontend-tiles` | A | Medium | ESM-only output, sinon |
| `editor/frontend` | — | None | No tests exist, just remove certa dep |
| `full-stack-tests/rpc-interface` | B | High | backendInitModule + CallbackUtils |
| `full-stack-tests/rpc` | B | High | Multiple transport backends |

## Key Files Reference

| File | Purpose |
|------|---------|
| `tools/vitest-certa-bridge/src/plugin.ts` | Vite plugin — HTTP middleware + backend init lifecycle |
| `tools/vitest-certa-bridge/src/client.ts` | Browser-side `executeBackendCallback` — IPC fallback for Electron, HTTP for Chrome |
| `tools/vitest-certa-bridge/src/callbackRegistry.ts` | Node.js-side callback registration and execution |
| `tools/vitest-certa-bridge/src/electron-main.ts` | Electron main-process helper — async IPC bridge with token auth |
| `tools/vitest-certa-bridge/src/types.ts` | Shared types |
| `core/i18n/vitest.config.mts` | Reference: browser-only migration with custom static serving |
| `full-stack-tests/ecschema-rpc-interface/vitest.config.mts` | Reference: full-stack migration with bridge plugin |
| `full-stack-tests/core/vitest.config.mts` | Reference: complex full-stack migration (null-loader, env vars, serial execution) |
| `full-stack-tests/core/src/backend/BackendServer.ts` | Reference: standalone backend server (separate process from bridge init) |
| `full-stack-tests/core/src/backend/BridgeInit.ts` | Reference: bridge-only init module (env + callbacks, no server) |
| `core/electron/vitest.config.mts` | Reference: Electron main-process tests (spawn per test) |
| `core/electron/vitest.frontend.config.mts` | Reference: Electron renderer tests (BrowserWindow harness) |

## Gotchas From Production Migrations

### Backend split (BackendServer.ts vs BridgeInit.ts)

When a package's `backend.ts` both starts an RPC server AND registers callbacks, you MUST split it:
- `BackendServer.ts` — starts server, run via `node lib/backend/BackendServer.js`
- `BridgeInit.ts` — loads env + registers callbacks, used as `backendInitModule` in `certaBridge()`

Loading the combined `backend.ts` as `backendInitModule` would try to start the server inside Vite's Node.js process → EADDRINUSE conflict with the actual backend process.

### Explicit port strategy

Do NOT derive backend port from `window.location.port`. Vitest's dev server may use a different port than Certa. Instead:
- Set `server.port: 3010` in vitest config (or any explicit port)
- Backend uses `FULL_STACK_BACKEND_PORT` env var or hardcoded constant
- Frontend setup reads the same constant

### Serial execution

Tests sharing mutable state (IModelApp, auth clients, Azurite, cache dirs) MUST run serially:
```typescript
test: {
  fileParallelism: false,
}
```

### Electron IPC bridge (Scenario C)

The `@itwin/vitest-certa-bridge/client` `executeBackendCallback` transparently uses:
- **Chrome/Playwright**: HTTP fetch to `/__certa_bridge` middleware
- **Electron**: `window._CertaSendToBackend` (async IPC via `ipcRenderer.invoke`)

For Electron mode, inject the renderer shim via `getRendererShimScript(token)` from `@itwin/vitest-certa-bridge/electron-main`. The shim sets up `_CertaSendToBackend` to use async IPC (`ipcMain.handle`/`ipcRenderer.invoke`) instead of Certa's sync `sendSync`.
