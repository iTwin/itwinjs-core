# @itwin/vitest-certa-bridge File Manifest

## Core Plugin Package: tools/vitest-certa-bridge/

### Source Files (src/)
| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 11 | Main exports: certaBridge, nullLoader, preferEsm |
| `src/plugin.ts` | 140 | **Core Vite plugin**: HTTP bridge middleware |
| `src/types.ts` | 24 | TypeScript interfaces |
| `src/client.ts` | 40 | Browser API: executeBackendCallback() |
| `src/callbackRegistry.ts` | 40 | Backend registry: register/execute callbacks |
| `src/electron-main.ts` | 84 | Electron IPC bridge initialization |
| `src/nullLoader.ts` | 37 | Vite plugin: stub Node.js modules |
| `src/preferEsm.ts` | 59 | Vite plugin: rewrite lib/cjs → lib/esm |
| `src/test/bridge.test.ts` | 46 | Unit tests for callbackRegistry |
| **Total src** | **521** | |

### Build Output
- `lib/cjs/*` — Compiled CommonJS (dual-package support)
- `lib/esm/*` — Compiled ES Modules

### Configuration
- `tsconfig.json` — TypeScript configuration
- `package.json` — Dependencies, exports, scripts

---

## Test Configurations

| File | Lines | Purpose |
|------|-------|---------|
| `full-stack-tests/core/vitest.config.mts` | 130 | **Chrome/Playwright** config |
| `full-stack-tests/core/vitest.electron.config.mts` | 23 | **Electron** config |

---

## Backend Initialization

### Chrome Mode
| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| `BridgeInit.ts` | `full-stack-tests/core/src/backend/` | 30 | Load .env + register callbacks |
| `BackendServer.ts` | `full-stack-tests/core/src/backend/` | 295 | Standalone Node.js backend server (port 5010) |

### Electron Mode
| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| `backend.ts` | `full-stack-tests/core/src/backend/` | 79 | ElectronHost initialization |

### Supporting Backend Files
| File | Lines | Purpose |
|------|-------|---------|
| `RpcImpl.ts` | ~150 | RPC interface implementations |
| `TestEditCommands.ts` | ~100 | Edit command implementations |
| `AzuriteTest.ts` | ~200 | Azure test utilities |
| `certaBackend.ts` | 30 | Callback registration (auth tokens) |
| `certaCommon.ts` | ~50 | Shared constants/types |

---

## Test Orchestration (Electron Mode)

| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| `RunElectronFrontendTests.ts` | `full-stack-tests/core/src/electron/` | 186 | **Vitest orchestrator**: spawns shards |
| `RunElectronSession.ts` | `full-stack-tests/core/src/electron/` | 531 | **Electron session runner**: test executor |

### Detailed Breakdown: RunElectronFrontendTests.ts
```typescript
Lines 1-45:   Imports and configuration
Lines 46-90:  spawnElectronShard() function
Lines 91-113: shardTestFiles() function
Lines 115-140: Single-file mode (targeted runs)
Lines 142-185: Parallel mode (main test suite)
```

### Detailed Breakdown: RunElectronSession.ts
```typescript
Lines 1-50:   Imports, env loading, initialization
Lines 51-150: Backend initialization (backend.ts require)
Lines 151-250: BrowserWindow setup + HTML generation
Lines 251-400: Custom vitest shim (describe/it/expect)
Lines 401-480: Test runner loop (runSuite, executeTest)
Lines 481-531: Test execution (require test files, run suite)
```

---

## Test Files

### Frontend Tests (full-stack-tests/core/src/frontend/)
Located in `src/frontend/` (compiled to `lib/frontend/`):

**Standalone tests** (no backend required):
- Categories.test.ts
- CodeSpecs.test.ts
- DisplayStyleState.test.ts
- Elements.test.ts
- ModelState.test.ts
- ... and 50+ more

**Hub tests** (require backend + iModel):
- IModelConnection.test.ts
- ScheduleScript.test.ts
- HyperModeling.test.ts

**Tile tests** (heavy compute):
- tile/TileIO.test.ts
- tile/TileTree.test.ts
- tile/ElementGraphics.test.ts

**Estimated:** 80+ test files, 1000+ individual test cases

### Test Utilities
| File | Purpose |
|------|---------|
| `vitest.setup.ts` | Vitest setup: auth, RPC init, error handling |
| `TestUtility.ts` | Helper functions for tests |
| `TestSnapshotConnection.ts` | SnapshotDb test fixture |
| `TestViewport.ts` | Viewport test fixture |

---

## Common Files

| File | Purpose |
|------|---------|
| `RpcInterfaces.ts` | Shared RPC interface definitions |
| `FullStackTestIpc.ts` | IPC handler interface (model manipulation) |
| `TestEditCommandIpc.ts` | Edit command IPC interface |
| `IModelHubUserMgr.ts` | User/token management |

---

## Complete File Tree

```
tools/vitest-certa-bridge/
├── src/
│   ├── index.ts (11)
│   ├── plugin.ts (140) ⭐ CORE
│   ├── types.ts (24)
│   ├── client.ts (40)
│   ├── callbackRegistry.ts (40)
│   ├── electron-main.ts (84)
│   ├── nullLoader.ts (37)
│   ├── preferEsm.ts (59)
│   └── test/
│       ├── bridge.test.ts
│       └── electron-bridge.test.ts
├── lib/
│   ├── cjs/ (compiled)
│   └── esm/ (compiled)
├── package.json
└── tsconfig.json

full-stack-tests/core/
├── vitest.config.mts (130) ⭐ CHROME
├── vitest.electron.config.mts (23) ⭐ ELECTRON
├── src/
│   ├── backend/
│   │   ├── BridgeInit.ts (30) ⭐ Chrome bridge
│   │   ├── backend.ts (79) ⭐ Electron backend
│   │   ├── BackendServer.ts (295) ⭐ Chrome server
│   │   ├── RpcImpl.ts
│   │   ├── TestEditCommands.ts
│   │   └── AzuriteTest.ts
│   ├── electron/
│   │   ├── RunElectronFrontendTests.ts (186) ⭐ ORCHESTRATOR
│   │   └── RunElectronSession.ts (531) ⭐ SESSION RUNNER
│   ├── certa/
│   │   ├── certaBackend.ts (30)
│   │   └── certaCommon.ts
│   ├── common/
│   │   ├── RpcInterfaces.ts
│   │   ├── FullStackTestIpc.ts
│   │   └── ...
│   └── frontend/
│       ├── vitest.setup.ts
│       ├── _Setup.test.ts
│       ├── TestUtility.ts
│       ├── standalone/
│       │   ├── BlankConnection.test.ts
│       │   ├── SnapshotConnection.test.ts
│       │   ├── Categories.test.ts
│       │   ├── tile/
│       │   │   ├── TileIO.test.ts
│       │   │   └── ...
│       │   └── ... (60+ files)
│       ├── hub/
│       │   ├── IModelConnection.test.ts
│       │   ├── ScheduleScript.test.ts
│       │   └── ...
│       └── ...
└── lib/ (compiled output)
```

---

## Key Metrics

### Plugin Size
- **Source:** 521 total lines (plugin.ts = 27% of codebase)
- **Build:** Dual CJS + ESM outputs
- **External deps:** Vite, Vitest, Electron (peer dependencies)

### Test Infrastructure
- **Configs:** 2 files (Chrome + Electron)
- **Orchestration:** 717 lines (RunElectronFrontendTests + RunElectronSession)
- **Backend:** 404 lines (BridgeInit + BackendServer + backend.ts)
- **Callbacks:** 30 lines (certaBackend.ts)

### Tests
- **Test files:** ~80 frontend test files
- **Test cases:** ~1000+
- **Lines in test code:** ~50,000+ (estimated)

---

## Most Critical Files (for redesign)

### Must understand:
1. **plugin.ts** (140 lines) — HTTP middleware + token injection
2. **RunElectronFrontendTests.ts** (186 lines) — Shard orchestration
3. **RunElectronSession.ts** (531 lines) — Test execution engine
4. **vitest.config.mts** (130 lines) — Chrome configuration
5. **BackendServer.ts** (295 lines) — Chrome backend server

### Should understand:
6. **electron-main.ts** (84 lines) — IPC bridge setup
7. **client.ts** (40 lines) — Browser API
8. **callbackRegistry.ts** (40 lines) — Callback registry
9. **backend.ts** (79 lines) — Electron backend init

### Nice to have:
10. **nullLoader.ts** (37 lines) — Vite plugin
11. **preferEsm.ts** (59 lines) — Vite plugin
12. **certaBackend.ts** (30 lines) — Auth callbacks

---

## Compilation & Build

### Build Steps
```bash
# Plugin package
cd tools/vitest-certa-bridge
npm run build          # Generates lib/cjs + lib/esm
npm run build:cjs      # CJS only
npm run build:esm      # ESM only

# Full-stack tests
cd full-stack-tests/core
npm run build          # Compiles src/ to lib/
```

### Output
- `tools/vitest-certa-bridge/lib/cjs/` — CommonJS (for Node.js)
- `tools/vitest-certa-bridge/lib/esm/` — ES Modules (for browser)
- `full-stack-tests/core/lib/` — Compiled test code

---

## Execution Entry Points

### Chrome Mode
```bash
# Terminal 1: Start backend server
cd full-stack-tests/core
node lib/backend/BackendServer.js

# Terminal 2: Run tests
cd full-stack-tests/core
npx vitest
```

### Electron Mode
```bash
cd full-stack-tests/core
npx vitest -c vitest.electron.config.mts
# Internally calls: RunElectronFrontendTests.ts
#   → spawnElectronShard() → electron RunElectronSession.js
```

---

## Environment & Dependencies

### peer dependencies (@itwin/vitest-certa-bridge)
- vite >=5.0.0
- vitest >=3.0.0
- electron >=28.0.0 (optional)

### devDependencies (@itwin/vitest-certa-bridge)
- @types/node ~20.17.0
- typescript ~5.6.2

### Runtime Dependencies (full-stack-tests/core)
- @itwin/core-backend (ElectronHost, IModelHost)
- @itwin/core-frontend (IModelApp, rendering)
- @itwin/express-server (WebEditServer)
- @itwin/oidc-signin-tool (auth)
- dotenv, dotenv-expand (environment)

