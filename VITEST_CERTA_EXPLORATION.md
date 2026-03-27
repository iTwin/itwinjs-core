# @itwin/vitest-certa-bridge + full-stack-tests/core Exploration

## Executive Summary

This is a **test infrastructure bridge** that allows browser-side test code (running in Vitest browser mode or Electron) to invoke Node.js backend callbacks for full-stack testing. It replaces the legacy `@itwin/certa` test framework.

**Two execution modes:**
1. **Chrome/Playwright mode** (vitest.config.mts): Browser tests run via Vitest browser provider; backend in separate process; HTTP bridge via `/__certa_bridge`
2. **Electron mode** (vitest.electron.config.mts): Real Electron process; backend in-process; async IPC bridge; parallel sharding via RunElectronFrontendTests

---

## 1. Package Structure: @itwin/vitest-certa-bridge

**Location:** `/tools/vitest-certa-bridge/`

### Directory Tree

```
tools/vitest-certa-bridge/
├── package.json                    # Main package metadata + exports
├── tsconfig.json                   # TypeScript config
├── src/
│   ├── index.ts                    # Main exports (certaBridge, nullLoader, preferEsm, types)
│   ├── plugin.ts                   # Core Vite plugin implementation (140 lines)
│   ├── types.ts                    # TypeScript interfaces (BridgeRequest, CertaBridgeOptions)
│   ├── client.ts                   # executeBackendCallback() — browser API
│   ├── callbackRegistry.ts         # registerBackendCallback() — backend registry
│   ├── electron-main.ts            # Electron IPC bridge initialization
│   ├── nullLoader.ts               # Vite plugin: null-loader for Node.js modules
│   ├── preferEsm.ts                # Vite plugin: rewrites lib/cjs → lib/esm
│   └── test/
│       ├── bridge.test.ts          # Unit tests for callbackRegistry
│       ├── electron-bridge.test.ts
│       └── mock-backend.ts
├── lib/cjs/                        # Compiled CJS (dual package support)
│   └── *.js, *.d.ts
└── lib/esm/                        # Compiled ESM
    └── *.js, *.d.ts
```

---

## 2. package.json: Full Contents

```json
{
  "name": "@itwin/vitest-certa-bridge",
  "version": "5.8.0-dev.6",
  "description": "Vitest plugin that bridges browser test code to Node.js backend callbacks, replacing @itwin/certa",
  "main": "lib/cjs/index.js",
  "module": "lib/esm/index.js",
  "typings": "lib/cjs/index",
  "exports": {
    ".": {
      "import": "./lib/esm/index.js",
      "require": "./lib/cjs/index.js",
      "types": "./lib/cjs/index.d.ts"
    },
    "./client": {
      "import": "./lib/esm/client.js",
      "require": "./lib/cjs/client.js",
      "types": "./lib/cjs/client.d.ts"
    },
    "./callbackRegistry": {
      "import": "./lib/esm/callbackRegistry.js",
      "require": "./lib/cjs/callbackRegistry.js",
      "types": "./lib/cjs/callbackRegistry.d.ts"
    },
    "./electron-main": {
      "import": "./lib/esm/electron-main.js",
      "require": "./lib/cjs/electron-main.js",
      "types": "./lib/cjs/electron-main.d.ts"
    }
  },
  "scripts": {
    "build": "npm run -s build:cjs && npm run -s build:esm",
    "build:cjs": "tsc 1>&2 --outDir lib/cjs",
    "build:esm": "tsc 1>&2 --module ES2022 --outDir lib/esm",
    "clean": "rimraf -g lib .rush/temp/package-deps*.json",
    "lint": "eslint \"./src/**/*.ts\" 1>&2",
    "test": "vitest run"
  },
  "devDependencies": {
    "@itwin/build-tools": "workspace:*",
    "@itwin/eslint-plugin": "^6.0.0",
    "@types/node": "~20.17.0",
    "eslint": "^9.31.0",
    "rimraf": "^6.0.1",
    "typescript": "~5.6.2",
    "vitest": "^3.0.6",
    "vite": "^6.4.0"
  },
  "peerDependencies": {
    "vite": ">=5.0.0",
    "vitest": ">=3.0.0",
    "electron": ">=28.0.0"
  },
  "peerDependenciesMeta": {
    "electron": {
      "optional": true
    }
  }
}
```

**Key exports:**
- `.` → Main plugin (certaBridge, nullLoader, preferEsm)
- `./client` → Browser-side executeBackendCallback()
- `./callbackRegistry` → Backend registry (registerBackendCallback, executeRegisteredCallback)
- `./electron-main` → Electron IPC bridge (initElectronBridge, getRendererShimScript)

---

## 3. Main Plugin Source: plugin.ts

**File:** `tools/vitest-certa-bridge/src/plugin.ts` (140 lines)

### certaBridge() Function

```typescript
export function certaBridgePlugin(opts: CertaBridgeOptions = {}): Plugin
```

**Key responsibilities:**

1. **Token Generation:** Creates a per-session UUID to prevent unauthorized callback invocation
2. **HTML Transform:** Injects bridge token + window._CertaSendToBackend (HTTP fallback for Certa compat)
3. **Backend Initialization:** Loads backendInitModule if specified
4. **Middleware:** Registers `/__certa_bridge` POST handler
5. **IPC Proxy:** If backendPort specified, auto-configures Vite proxy for `/ipc` WebSocket

**Request/Response Flow (Chrome mode):**
```
Browser Test → fetch("/__certa_bridge", { name, args, token }) 
  → Plugin middleware → executeRegisteredCallback(name, args)
  → Response { result? } or { error }
```

**Configuration:** CertaBridgeOptions
```typescript
interface CertaBridgeOptions {
  backendInitModule?: string;  // Path to BridgeInit.js (loads .env, registers callbacks)
  backendPort?: number;        // Enables /ipc WebSocket proxy to backend
}
```

---

## 4. Supporting Plugin Files

### client.ts: Browser API
```typescript
export async function executeBackendCallback(name: string, ...args: any[]): Promise<any>
```
- **Electron mode:** Uses `_CertaSendToBackend` (IPC)
- **Chrome mode:** Uses fetch to `/__certa_bridge`
- Handles error responses with proper stack traces

### callbackRegistry.ts: Backend Registry
```typescript
registerBackendCallback(name, cb)           // Register a callback
executeRegisteredCallback(name, args)       // Execute by name
getCallbacksRegisteredOnBackend()           // List all
clearCallbacks()                            // For cleanup
```
- Uses `globalThis._CertaRegisteredCallbacks` to support both CJS/ESM
- Avoids module duplication issues

### electron-main.ts: Electron IPC Bridge
```typescript
initElectronBridge(options): { token }
getRendererShimScript(token): string
```
- Registers async IPC handler `ipcMain.handle("certa-callback", ...)`
- Generates renderer shim that sets up `window._CertaSendToBackend`
- Token-based security

### nullLoader.ts: Vite Plugin
Stubs Node.js-only packages (azure-storage, ws, dotenv, tunnel) for browser:
```typescript
nullLoader([/azure-storage/, /ws\/index\.js$/, /dotenv/])
```
Returns empty module `export default {}; export {};`

### preferEsm.ts: Vite Plugin
Rewrites deep imports from lib/cjs to lib/esm at resolve time:
```typescript
preferEsm({
  "@itwin/core-frontend": path.resolve(__dirname, "../../core/frontend"),
})
```
Handles:
- `@itwin/core-frontend/lib/cjs/Foo` → `<root>/lib/esm/Foo.js`
- Avoids Vite's inability to consume CJS named exports

---

## 5. Current Chrome Config: full-stack-tests/core/vitest.config.mts

```typescript
import { defineConfig } from "vitest/config";
import { certaBridge, nullLoader, preferEsm } from "@itwin/vitest-certa-bridge";

export default defineConfig({
  esbuild: { target: "es2022" },
  
  plugins: [
    certaBridge({
      backendInitModule: path.resolve(__dirname, "lib/backend/BridgeInit.js"),
      backendPort: 5010,  // Forward /ipc to BackendServer on port 5010
    }),
    preferEsm({
      "@itwin/core-frontend": path.resolve(__dirname, "../../core/frontend"),
    }),
    nullLoader([/azure-storage/, /AzureFileHandler/, ...]),  // Stub Node.js packages
  ],
  
  resolve: {
    dedupe: ["@itwin/core-frontend", "@itwin/core-common", ...],
    alias: {
      "assert": "assert",
      "stream": "stream-browserify",
      "zlib": "browserify-zlib",
      "path": "path-browserify",
      "http": "stream-http",
      "https": "https-browserify",
    },
  },
  
  optimizeDeps: {
    include: ["js-base64", "flatbuffers"],
    exclude: ["@itwin/core-frontend", "@itwin/core-common", ...],
  },
  
  define: {
    "process.env.IMODELJS_CORE_DIRNAME": ...,
    "process.env.IMJS_URL_PREFIX": ...,
    "process.env.FULL_STACK_BACKEND_PORT": ...,
  },
  
  server: {
    port: 3010,
    fs: {
      allow: [
        "./node_modules/@itwin/hypermodeling-frontend/lib/public/",
        "./node_modules/@itwin/core-frontend/lib/public/",
        "../..",  // Parent workspace
      ],
    },
  },
  
  test: {
    dir: "src",
    globals: false,
    testTimeout: 240000,
    hookTimeout: 240000,
    fileParallelism: false,
    setupFiles: ["src/frontend/vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/_Setup.test.ts"],
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [{
        browser: "chromium",
        launch: { args: ["--disable-web-security", "--no-sandbox"] },
      }],
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

**Architecture:**
- Backend: Separate Node.js process (BackendServer.ts, port 5010)
- Frontend: Vitest browser mode (Playwright Chromium on port 3010)
- Bridge: HTTP middleware + WebSocket proxy

---

## 6. Current Electron Config: full-stack-tests/core/vitest.electron.config.mts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/electron",
    include: ["**/RunElectronFrontendTests.ts"],
    testTimeout: 300_000,
    reporters: [
      "default",
      ["junit", { outputFile: "lib/test/electron_junit_results.xml" }],
    ],
    pool: "forks",  // Node.js mode (spawns child processes)
  },
});
```

**Architecture:**
- Node.js-only (pool: "forks")
- RunElectronFrontendTests.ts spawns multiple Electron shards
- Each shard: independent Electron process with isolated backend state

---

## 7. RunElectronFrontendTests.ts: Orchestrator (186 lines)

**File:** `full-stack-tests/core/src/electron/RunElectronFrontendTests.ts`

**Purpose:** Vitest test suite that spawns parallel Electron shards

### Key Functions

```typescript
async function spawnElectronShard(options: {
  shardId: string;
  cacheDir: string;
  grepPattern?: string;
  invertGrep?: boolean;
  fileGlob?: string;
}): Promise<number>
```
- Spawns `electron lib/electron/RunElectronSession.js`
- Passes env vars: ELECTRON_SHARD_ID, ELECTRON_CACHE_DIR, ELECTRON_TEST_GREP
- Returns exit code

```typescript
function shardTestFiles(testDir, glob, shardCount): string[][]
```
- Discovers test files from `lib/frontend/**/*.test.js`
- Round-robin distributes across N shards

### Test Suites

**Single-file mode** (env: ELECTRON_TEST_GLOB)
- One shard, one Electron process
- Used for targeted debugging

**Parallel mode** (default)
- Discovers all test files
- Distributes across DEFAULT_SHARD_COUNT (4) shards
- Cleanup: `fs.rmSync(cacheDir, { recursive: true })`

### Parallelization Notes

- **State isolation:** Each shard has its own cache dir, env vars, backend state
- **Shared assets:** Test .bim files in `core/backend/lib/cjs/test/assets/` (read-only)
- **Lock contention:** Tests using StandaloneDb (read-write) must be in same shard

---

## 8. RunElectronSession.ts: Session Runner (531 lines)

**File:** `full-stack-tests/core/src/electron/RunElectronSession.ts`

### Architecture

Single Electron main process, one BrowserWindow, sequential test execution.

### Main Components

**Lines 1-50:**
```typescript
import { app, BrowserWindow, ipcMain } from "electron";
import { executeRegisteredCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";

// Load .env
loadEnv(path.join(__dirname, "..", "..", ".env"));

// Set IMODELJS_CORE_DIRNAME for CJS requires
if (!process.env.IMODELJS_CORE_DIRNAME)
  process.env.IMODELJS_CORE_DIRNAME = path.resolve(...);

const shardId = process.env.ELECTRON_SHARD_ID || `pid-${process.pid}`;
const bridgeToken = crypto.randomUUID();

async function main() {
  await app.whenReady();
  const backendInit = require("../backend/backend");
  // ... backend initialization
}
```

**Lines 481-531 (Test Execution Loop):**
```typescript
// Vitest shim — provides describe/it/expect
const vitestShim = {
  describe: (name, fn) => { suites.push({ name, fn }); },
  it: (name, fn, timeout?) => { pendingSuites[-1]?.tests.push({ ... }); },
  expect: () => new Assertion(...),
  ...
};

// Runner: execute all registered describe/it blocks
async function runAllTests() {
  // Load setup file (registers RPC, auth)
  require(setupFile);
  
  // Load all test files
  const testFiles = [...];
  for (const file of testFiles) {
    try { require(file); } catch (err) { ... }
  }
  
  // Run all registered suites sequentially
  for (const suite of suites) {
    console.log("Suite:", suite.name);
    await runSuite(suite, "", [], []);
  }
  
  ipcRenderer.send("electron-test-results", pendingResults);
}

// Delay 200ms for module-level code, then run
setTimeout(() => runAllTests().catch(...), 200);
```

### IPC Bridge

- Main process: `ipcMain.handle("certa-callback", ...)` listens for renderer calls
- Renderer: `window._CertaSendToBackend` = `ipcRenderer.invoke("certa-callback", ...)`

---

## 9. Backend Files

### backend.ts: Electron-Mode Backend (79 lines)

**File:** `full-stack-tests/core/src/backend/backend.ts`

**Responsibility:** Electron-only backend initialization (also handles legacy Certa mode)

```typescript
async function init() {
  loadEnv(...);
  RpcConfiguration.developmentMode = true;
  
  const iModelHost: IModelHostOptions = {
    cacheDir: process.env.ELECTRON_CACHE_DIR || path.join(__dirname, ".cache"),
    hubAccess: new BackendIModelsAccess(...),
  };
  
  if (ProcessDetector.isElectronAppBackend) {
    exposeBackendCallbacks();  // Register getToken(), etc.
    const electronAuth = new ElectronMainAuthorization(...);
    await electronAuth.signInSilent();
    await ElectronHost.startup({ rpcInterfaces, iModelHost });
    
    EditCommandAdmin.registerModule(testCommands);
    FullStackTestIpcHandler.register();
  } else {
    throw new Error("backend.ts is now Electron-only. Use BackendServer.ts for Chrome/web mode.");
  }
}

module.exports = init();  // Export promise
```

**Exports:** Promise that resolves when backend is ready

### BackendServer.ts: Chrome-Mode Backend Server (295 lines)

**File:** `full-stack-tests/core/src/backend/BackendServer.ts`

**Responsibility:** Standalone Node.js process for Chrome/Playwright tests

```typescript
export class FullStackTestIpcHandler extends IpcHandler {
  // IPC methods called from Chrome tests via bridge
  async createAndInsertPhysicalModel(key, newModelCode): Promise<Id64String>
  async createAndInsertSpatialCategory(key, scopeModelId, ...): Promise<Id64String>
  async insertElement(iModelKey, props): Promise<Id64String>
  async updateElement(iModelKey, props): Promise<void>
  // ... 20+ other methods
}

export const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

async function startServer() {
  loadEnv(...);
  const iModelHost = { cacheDir: path.join(__dirname, ".cache") };
  
  const rpcConfig = BentleyCloudRpcManager.initializeImpl(...);
  const webEditServer = new WebEditServer(rpcConfig.protocol);
  const httpServer = await webEditServer.initialize(backendPort);
  console.log(`Web backend listening on port ${backendPort}`);
  
  await LocalhostIpcHost.startup({ iModelHost, noServer: true });
  
  EditCommandAdmin.registerModule(testCommands);
  FullStackTestIpcHandler.register();
  ECSchemaRpcImpl.register();
  
  // Graceful shutdown
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  startServer().catch(err => { ... });
}
```

**Port:** 5010 (configurable via FULL_STACK_BACKEND_PORT)

### BridgeInit.ts: Chrome-Mode Bridge Initializer (30 lines)

**File:** `full-stack-tests/core/src/backend/BridgeInit.ts`

**Purpose:** Minimal init for Chrome mode (used as `backendInitModule`)

```typescript
import { exposeBackendCallbacks } from "../certa/certaBackend";

function loadEnv(envFile: string) { ... }

loadEnv(path.join(__dirname, "..", "..", ".env"));
exposeBackendCallbacks();  // Register getToken(), legacy callbacks
```

**Does NOT start RPC server** — that lives in BackendServer.ts (separate process)

---

## 10. Supporting Backend Files

### certaBackend.ts: Callback Registration (30 lines)

**File:** `full-stack-tests/core/src/certa/certaBackend.ts`

```typescript
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";

async function getAccessToken(user: any, oidcConfig?: any): Promise<AccessToken> {
  const accessToken = oidcConfig === undefined
    ? await OidcTestUtility.getAccessToken(user)
    : await OidcTestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken();
  
  // Electron backend
  const authClient = IModelHost.authorizationClient as { setAccessToken? };
  authClient?.setAccessToken?.(accessToken);
  return accessToken;
}

export function exposeBackendCallbacks() {
  registerBackendCallback(getTokenCallbackName, getAccessToken);
  registerBackendCallback("getToken", getAccessToken);  // Legacy
}
```

**Exposes:** Token callbacks for OIDC auth tests

### RpcImpl.ts, TestEditCommands.ts, AzuriteTest.ts

Standard backend RPC implementations (not bridge-specific).

---

## 11. Full-Stack Tests Directory Structure

```
full-stack-tests/core/src/
├── backend/
│   ├── backend.ts                    # Electron-mode backend init
│   ├── BackendServer.ts              # Chrome-mode backend (separate process)
│   ├── BridgeInit.ts                 # Chrome-mode bridge init (minimal)
│   ├── RpcImpl.ts
│   ├── TestEditCommands.ts
│   ├── AzuriteTest.ts
├── electron/
│   ├── RunElectronFrontendTests.ts   # Vitest orchestrator (parallel shards)
│   └── RunElectronSession.ts         # Electron session runner (531 lines)
├── common/
│   ├── FullStackTestIpc.ts
│   ├── IModelHubUserMgr.ts
│   ├── RpcInterfaces.ts
│   └── TestEditCommandIpc.ts
├── certa/
│   ├── certaBackend.ts               # Callback registration
│   └── certaCommon.ts
└── frontend/
    ├── vitest.setup.ts               # Vitest setup (auth, RPC init)
    ├── _Setup.test.ts                # Skipped in Electron mode
    ├── app/
    │   └── NativeApp.test.ts
    ├── hub/
    │   ├── IModelConnection.test.ts
    │   ├── ScheduleScript.test.ts
    │   ├── HyperModeling.test.ts
    │   └── ...
    ├── standalone/
    │   ├── BlankConnection.test.ts
    │   ├── SnapshotConnection.test.ts
    │   ├── Categories.test.ts
    │   ├── tile/
    │   │   ├── TileIO.test.ts
    │   │   ├── TileTree.test.ts
    │   │   └── ...
    │   └── ... (60+ test files)
    ├── map/
    │   ├── BackgroundMap.test.ts
    │   └── ...
    ├── TestUtility.ts                # Test helpers
    ├── TestSnapshotConnection.ts
    └── FrontendPerfReporter.ts
```

**Test count:** 80+ test files, 1000+ test cases

---

## 12. Key Configurations & Workarounds

### Resolve Aliases (Polyfills)
```typescript
alias: {
  "assert": "assert",              // assert npm package
  "stream": "stream-browserify",   // polyfill
  "zlib": "browserify-zlib",       // polyfill
  "path": "path-browserify",
  "http": "stream-http",
  "https": "https-browserify",
}
```

### Null-Loader Patterns
```typescript
nullLoader([
  /azure-storage/,
  /AzureFileHandler/,
  /UrlFileHandler/,
  /AzureSdkFileHandler/,
  /ws\/index\.js$/,
  /tunnel\.js/,
  /dotenv/,
])
```

### OptimizeDeps
- **include:** js-base64, flatbuffers (pre-bundle)
- **exclude:** @itwin packages (not pre-optimized)

### Dedupe
Ensures single instances in browser:
```typescript
dedupe: [
  "@itwin/core-frontend",
  "@itwin/core-common",
  "@itwin/core-bentley",
  "@itwin/core-geometry",
  "@itwin/core-quantity",
]
```

### Environment Variables
```
FULL_STACK_BACKEND_PORT       # Backend server port (default 5010)
IMJS_URL_PREFIX               # API endpoint prefix
IMODELJS_CORE_DIRNAME         # Core package root
ELECTRON_SHARD_ID             # Per-shard identifier
ELECTRON_CACHE_DIR            # Per-shard cache (tmpdir)
ELECTRON_TEST_GREP            # Test filter (regex)
ELECTRON_TEST_GLOB            # File pattern for targeted runs
VITEST_ELECTRON_GREP          # Passed to RunElectronFrontendTests
VITEST_ELECTRON_INVERT        # Invert grep filter
```

---

## 13. Execution Flow Summary

### Chrome Mode (vitest.config.mts)

1. **Start Vitest** (`vitest`)
2. **Vite dev server** starts (port 3010)
3. **Plugin initialization:**
   - Loads BridgeInit.js (registers callbacks)
   - Configures /ipc WebSocket proxy to port 5010
4. **Browser launch** (Playwright Chromium)
5. **Browser test files** execute, call `executeBackendCallback("token", ...)`
6. **Request flow:**
   - Browser → fetch("/__certa_bridge", { name, args, token })
   - Vite middleware → executeRegisteredCallback()
   - If LocalhostIpcApp: WebSocket → /ipc → BackendServer (port 5010)
7. **Response:** JSON with result or error

**Prerequisite:** BackendServer.ts must be running separately:
```bash
node lib/backend/BackendServer.js
```

### Electron Mode (vitest.electron.config.mts)

1. **Start Vitest** (`vitest -c vitest.electron.config.mts`)
2. **RunElectronFrontendTests.ts** (Node.js test suite) runs
3. **Test discovery:**
   - Discovers `lib/frontend/**/*.test.js`
   - Shards into N groups (default 4)
4. **For each shard:**
   - Create temp cache dir
   - Spawn Electron: `electron lib/electron/RunElectronSession.js`
   - Pass env: ELECTRON_SHARD_ID, ELECTRON_CACHE_DIR
5. **Electron process (RunElectronSession.ts):**
   - Load .env
   - Require backend.ts (starts ElectronHost, registers callbacks)
   - Create BrowserWindow → inject renderer shim
   - Load test files (require them)
   - Execute describe/it blocks
   - Collect results → ipcMain
6. **Parent process** waits for exit code
7. **Cleanup:** Remove temp cache dir

---

## 14. Current State & Limitations

### Chrome Mode
✅ Functional
- Tests run in Playwright Chromium
- Backend in separate process
- HTTP bridge works
- No parallel browser instances (fileParallelism: false)

⚠️ Challenges
- Must manually start BackendServer.js
- No hot-reload on backend changes
- Single browser instance limits concurrency

### Electron Mode
✅ Functional
- Parallel shard execution
- State isolation per shard
- IPC bridge for renderer→main callbacks
- Matches Certa behavior

⚠️ Challenges
- Slow: all tests run sequentially within each shard
- BrowserWindow creation overhead per shard
- Limited test filtering (grep via regex env var)
- No true parallelism within shard

### Common
⚠️ No dynamic test discovery — test files must be pre-compiled (lib/frontend/*.test.js)
⚠️ No reuse of running backend between test runs
⚠️ IPC bridge token system adds complexity

---

## 15. Key Files for Redesign Planning

**Core plugin logic:**
- `tools/vitest-certa-bridge/src/plugin.ts` (140 lines) — HTTP bridge middleware
- `tools/vitest-certa-bridge/src/electron-main.ts` (84 lines) — IPC bridge

**Test orchestration:**
- `full-stack-tests/core/src/electron/RunElectronFrontendTests.ts` (186 lines) — Shard spawner
- `full-stack-tests/core/src/electron/RunElectronSession.ts` (531 lines) — Session runner

**Backend initialization:**
- `full-stack-tests/core/src/backend/BridgeInit.ts` (30 lines) — Chrome bridge init
- `full-stack-tests/core/src/backend/backend.ts` (79 lines) — Electron backend
- `full-stack-tests/core/src/backend/BackendServer.ts` (295 lines) — Chrome server

**Configuration:**
- `full-stack-tests/core/vitest.config.mts` — Chrome (130 lines)
- `full-stack-tests/core/vitest.electron.config.mts` — Electron (23 lines)

---

## 16. Type Definitions

### CertaBridgeOptions
```typescript
interface CertaBridgeOptions {
  backendInitModule?: string;  // Path to backend init module
  backendPort?: number;        // WebSocket proxy target port
}
```

### BridgeRequest / BridgeResponse
```typescript
interface BridgeRequest {
  name: string;
  args: any[];
}

interface BridgeResponse {
  result?: any;
  error?: { message: string; stack?: string };
}
```

### CertaBackendCallback
```typescript
type CertaBackendCallback = (...args: any[]) =>
  void | null | undefined | number | string | boolean |
  Promise<void> | Promise<null> | Promise<undefined> |
  Promise<number> | Promise<string> | Promise<boolean>;
```

---

## Summary

The `@itwin/vitest-certa-bridge` is a **lightweight bridge** enabling full-stack browser tests. It replaces the old Certa framework with a modern Vitest + Vite architecture while maintaining two distinct execution paths:

1. **Chrome/Playwright:** Shared browser testing with HTTP bridge
2. **Electron:** Isolated process testing with IPC bridge

Both modes support backend callbacks for RPC, model manipulation, and auth testing. The design prioritizes simplicity and modularity — each component (plugin, bridge, orchestrator) is independent and can be tested/refactored separately.

