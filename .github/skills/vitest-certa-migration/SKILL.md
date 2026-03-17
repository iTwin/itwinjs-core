---
name: vitest-certa-migration
description: Migrate iTwin.js packages from Certa + Mocha + webpack to Vitest browser mode with the vitest-certa-bridge plugin for backend callbacks.
---

# Migrating from Certa to Vitest

This skill covers migrating iTwin.js packages that use `@itwin/certa` (Mocha-based browser/Electron test runner with webpack bundling) to Vitest browser mode with Playwright. Packages that need backend↔frontend callback bridging use the `@itwin/vitest-certa-bridge` plugin.

## Two Migration Scenarios

### Scenario A: Browser-only tests (no backend callbacks)

Packages whose tests run entirely in the browser with no `registerBackendCallback` / `executeBackendCallback` usage and no `backendInitModule` in `certa.json`.

Examples: `core/i18n`, `core/markup`, `core/webgl-compatibility`, `core/hypermodeling`, `ui/appui-abstract`, `extensions/frontend-tiles`

### Scenario B: Full-stack tests with backend bridge

Packages that register Node.js-side callbacks and invoke them from browser-side test code. Identified by:
- `backendInitModule` in `certa.json`
- Imports from `@itwin/certa/lib/utils/CallbackUtils`

Examples: `full-stack-tests/core`, `full-stack-tests/rpc`, `full-stack-tests/rpc-interface`, `full-stack-tests/ecschema-rpc-interface`

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

**Solution:** Use `globalThis._CertaRegisteredCallbacks` as the single source of truth instead of a module-local variable. Both CJS and ESM instances read/write the same global object, eliminating the dual-instance problem. This also maintains backward compatibility with Certa's original global-based callback storage.

### 3. TypeScript subpath exports with `moduleResolution: "node"`

**Problem:** The bridge package uses `package.json` `"exports"` field for subpath imports (`@itwin/vitest-certa-bridge/client`). However, the repo's base `tsconfig-base.json` uses `"moduleResolution": "node"` which does **not** support the `exports` field. TypeScript reports `TS2307: Cannot find module`.

**Solution:** Add `"typesVersions"` to the bridge's `package.json`:
```json
"typesVersions": {
  "*": {
    "client": ["lib/cjs/client.d.ts"],
    "callbackRegistry": ["lib/cjs/callbackRegistry.d.ts"]
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

### 7. Vite dependency discovery reloading

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
| `full-stack-tests/core` | B | Very High | Azurite, complex backend init, tokens |

## Known Pitfalls and Solutions

These issues were discovered during the initial migration of `full-stack-tests/ecschema-rpc-interface` and apply to all Scenario B migrations. Scenario A packages may also hit some of these.

### 1. ESM file extensions in vitest-certa-bridge source

**Problem:** The bridge package emits dual CJS (`lib/cjs/`) and ESM (`lib/esm/`) output. When the ESM output is loaded by Node.js (which happens when Vitest processes `vitest.config.mts`), Node.js ESM requires explicit `.js` file extensions in relative `import` statements. TypeScript's `moduleResolution: "node"` compiles `from "./plugin"` as-is — it does NOT add `.js`.

**Symptom:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../lib/esm/plugin'
imported from .../lib/esm/index.js
```

**Solution:** All relative imports in `tools/vitest-certa-bridge/src/*.ts` must include `.js` extensions:
```typescript
// ✅ Correct — works in both CJS and ESM output
import { executeRegisteredCallback } from "./callbackRegistry.js";
import type { BridgeResponse } from "./types.js";

// ❌ Wrong — CJS works, ESM fails at runtime
import { executeRegisteredCallback } from "./callbackRegistry";
```

TypeScript with `moduleResolution: "node"` accepts `.js` extensions and maps them to `.ts` files during compilation. The `.js` extension passes through to the compiled output unchanged, which is what Node.js ESM needs.

**Why other packages don't hit this:** Most iTwin.js packages' ESM output is consumed by bundlers (Vite, webpack) which handle extensionless imports. The bridge plugin is unique because it's imported by `vitest.config.mts`, which Node.js loads directly before any bundler runs.

### 2. Subpath exports with `moduleResolution: "node"`

**Problem:** The bridge package uses `package.json` `"exports"` to expose subpaths like `@itwin/vitest-certa-bridge/client`. But the monorepo's base `tsconfig-base.json` sets `"moduleResolution": "node"`, which does NOT support the `exports` field — TypeScript can't find the type declarations.

**Symptom:**
```
error TS2307: Cannot find module '@itwin/vitest-certa-bridge/client'
or its corresponding type declarations.
```

**Solution:** Add `typesVersions` to `tools/vitest-certa-bridge/package.json`:
```json
{
  "typesVersions": {
    "*": {
      "client": ["lib/cjs/client.d.ts"],
      "callbackRegistry": ["lib/cjs/callbackRegistry.d.ts"]
    }
  }
}
```

`typesVersions` is the legacy mechanism for subpath type resolution and is respected by `moduleResolution: "node"`. The `exports` field still works at runtime for Node.js and bundlers.

### 3. CJS/ESM dual-package hazard (callback registry)

**Problem:** The bridge package ships both CJS and ESM builds. When `backendInitModule` (compiled as CJS) calls `registerBackendCallback()`, it loads `lib/cjs/callbackRegistry.js`. But the Vite plugin (loaded as ESM) uses `lib/esm/callbackRegistry.js`. These are two separate module instances with independent `callbacks` maps. Callbacks registered in CJS are invisible to the ESM plugin.

**Symptom:**
```
Error: Unknown certa backend callback "getEnv"
```
(Even though `getEnv` was registered by BackendInit.js)

**Solution:** Use `globalThis` as the single source of truth instead of a module-local variable:
```typescript
// ✅ Correct — shared across CJS and ESM instances
function getGlobalCallbacks() {
  if (!(globalThis as any)._CertaRegisteredCallbacks)
    (globalThis as any)._CertaRegisteredCallbacks = {};
  return (globalThis as any)._CertaRegisteredCallbacks;
}

// ❌ Wrong — each module format gets its own copy
const callbacks: Record<string, Function> = {};
```

This pattern is already how the original `@itwin/certa` worked (`global._CertaRegisteredCallbacks`). The bridge package must maintain this to stay compatible with CJS backend init modules.

### 4. Duplicate package imports (Vite dep pre-bundling)

**Problem:** Vite pre-bundles external dependencies into `.vite/deps/` for browser compatibility (CJS→ESM conversion). When an external package like `@itwin/imodels-access-frontend` depends on `@itwin/core-frontend`, Vite bundles a copy of `core-frontend` inside the pre-bundled dep. But test code also imports `core-frontend` directly from the workspace. The `core-frontend` package detects this duplication and throws.

**Symptom:**
```
Error: Multiple @itwin/core-frontend imports detected! This may happen if:
- You have multiple versions of the package installed
- Your bundling configuration is incorrect
- You're importing from both ESM and CommonJS versions
```

**Solution:** Two Vite config options work together:

```typescript
export default defineConfig({
  resolve: {
    // Forces all importers to resolve to the same physical copy
    dedupe: [
      "@itwin/core-frontend",
      "@itwin/core-common",
      "@itwin/core-bentley",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
    ],
  },
  optimizeDeps: {
    // Prevents workspace packages from being pre-bundled (which would
    // create a second copy inside the .vite/deps/ bundle)
    exclude: [
      "@itwin/core-frontend",
      "@itwin/core-common",
      "@itwin/core-bentley",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
      "@itwin/ecschema-metadata",
      "@itwin/ecschema-rpcinterface-common",
      "@itwin/presentation-common",
      "@itwin/presentation-frontend",
    ],
  },
});
```

**Rule of thumb:** Any `@itwin/*` workspace package that is also pulled in transitively by an external npm package must be listed in both `resolve.dedupe` and `optimizeDeps.exclude`.

### 5. Browser-externalized Node.js modules in plugin code

**Problem:** The `plugin.ts` file imports Node.js built-ins (`path`, `url`). If browser-side test code imports from the main entry point (`@itwin/vitest-certa-bridge`), Vite traces the dependency graph and tries to bundle `plugin.ts` for the browser, where `path`/`url` are externalized and crash.

**Symptom:**
```
Error: Module "path" has been externalized for browser compatibility.
Cannot access "path.resolve" in client code.
```

**Solution:** Browser-side code must NOT import from the main entry point. Use subpath imports that avoid the plugin module:

```typescript
// ✅ Browser-safe — callbackRegistry.ts has no Node.js imports
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { executeBackendCallback } from "@itwin/vitest-certa-bridge/client";

// ❌ Pulls in plugin.ts → path/url → crash in browser
import { registerBackendCallback } from "@itwin/vitest-certa-bridge";
```

The main entry point (`@itwin/vitest-certa-bridge`) is intended for `vitest.config.mts` only (Node.js context). All browser-side code should use `/client` for `executeBackendCallback` and `/callbackRegistry` for `registerBackendCallback`.

### 6. External packages using `window._CertaSendToBackend`

**Problem:** Some external npm packages (like `@itwin/oidc-signin-tool`) were written for Certa and call `window._CertaSendToBackend(name, args)` directly — the browser global that Certa's test runner injected. The bridge plugin uses `fetch("/__certa_bridge")` instead, so this global doesn't exist.

**Symptom:**
```
TypeError: window._CertaSendToBackend is not a function
```

**Solution:** The bridge plugin's `transformIndexHtml` hook injects a script that defines `window._CertaSendToBackend` as a thin wrapper around the bridge's HTTP endpoint. This is built into the plugin — no consumer action needed. Any external package that calls `window._CertaSendToBackend` will work automatically when the `certaBridge()` plugin is active.

If you encounter this with a new external package, verify that `certaBridge()` is in the `plugins` array. No other configuration is required.

### 7. Vite dependency discovery reloads (cosmetic warning)

**Problem:** On first run, Vite discovers transitive dependencies that weren't pre-optimized and triggers a page reload mid-test. This produces a warning but tests still pass.

**Symptom:**
```
[vitest] Vite unexpectedly reloaded a test. This may cause tests to fail,
lead to flaky behaviour or duplicated test runs.
For a stable experience, please add mentioned dependencies to your config's
`optimizeDeps.include` field manually.
```

**Solution:** Note the listed dependencies from the warning output and add them to `optimizeDeps.include`. These are typically transitive third-party dependencies discovered during the first test run:

```typescript
optimizeDeps: {
  include: [
    "js-base64",
    "flatbuffers",
    "fuse.js",
    // ... other deps listed in the warning
  ],
}
```

The dependencies must be directly resolvable from the package — if they're deep transitives, you may need to use the format `"@itwin/core-frontend > js-base64"`. Alternatively, running tests a second time after the initial discovery often resolves the issue as Vite caches the optimization.

## Key Files Reference

| File | Purpose |
|------|---------|
| `tools/vitest-certa-bridge/src/plugin.ts` | Vite plugin — HTTP middleware + backend init lifecycle |
| `tools/vitest-certa-bridge/src/client.ts` | Browser-side `executeBackendCallback` via fetch |
| `tools/vitest-certa-bridge/src/callbackRegistry.ts` | Node.js-side callback registration and execution |
| `tools/vitest-certa-bridge/src/types.ts` | Shared types |
| `core/i18n/vitest.config.mts` | Reference: browser-only migration with custom static serving |
| `full-stack-tests/ecschema-rpc-interface/vitest.config.mts` | Reference: full-stack migration with bridge plugin |
| `core/electron/vitest.config.mts` | Reference: Node.js-only Mocha→Vitest migration |
