# Electron Backend State Architecture Analysis - full-stack-tests/core

## Executive Summary
The Electron backend in `full-stack-tests/core` uses a **single-process, in-process architecture** where the Electron main process runs the backend, and tests communicate via IPC. Running 2+ Electron processes simultaneously would create **port conflicts, shared file locks, and singleton state collisions**.

---

## 1. BACKEND INITIALIZATION IN ELECTRON MODE

### Entry Point: `src/electron/RunElectronSession.ts`
- **Single Electron app.whenReady()** → loads and initializes backend from CJS module
- Loads `src/backend/backend.ts` as a required module (not imported—required at line 46)
- Waits for async initialization: `if (backendInit && typeof backendInit.then === "function") await backendInit`
- **One BrowserWindow** created with `nodeIntegration: true, contextIsolation: false`
- Creates **single session token** (`bridgeToken = crypto.randomUUID()`) for IPC bridge auth

### Backend Initialization: `src/backend/backend.ts`

**Key Initializations:**
```typescript
async function init() {
  // 1. SHARED IModelHost Singleton
  const iModelHost: IModelHostOptions = {};
  iModelHost.cacheDir = path.join(__dirname, ".cache");  // ← SHARED DIRECTORY
  
  // 2. Authorization Client (Electron-specific)
  const electronAuth = new ElectronMainAuthorization({...});
  await electronAuth.signInSilent();
  iModelHost.authorizationClient = electronAuth;
  
  // 3. ElectronHost Singleton Startup
  await ElectronHost.startup({ 
    electronHost: { rpcInterfaces }, 
    iModelHost 
  });
  
  // 4. RPC Registration
  EditCommandAdmin.registerModule(testCommands);
  EditCommandAdmin.register(BasicManipulationCommand);
  FullStackTestIpcHandler.register();  // IPC handlers
  
  // 5. Asset Resolver (Singleton)
  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver();
  
  // 6. Schema RPC
  ECSchemaRpcImpl.register();
}

module.exports = init();  // ← ASYNC EXPORT
```

**Singletons Initialized:**
- `IModelHost` (static singleton)
- `ElectronHost` (static singleton)
- `EditCommandAdmin` (global registration)
- `IModelHost.snapshotFileNameResolver` (static)
- All RPC interfaces (global BentleyCloudRpcManager)

---

## 2. ELECTRONHOST vs BACKENDSERVER

### ElectronHost (In-Process Backend)
**File:** `core/electron/src/backend/ElectronHost.ts`

```typescript
export class ElectronHost {
  private static _ipc: ElectronIpc;
  private static _mainWindow?: BrowserWindow;
  public static get ipcMain() { return this._electron?.ipcMain; }
  
  // Startup integrates with IModelHost
  static async startup(opts: ElectronHostOpts) {
    // Uses Electron's ipcMain directly
    // Backend runs in main process, shares memory with frontend
    // No HTTP server—all communication via IPC
  }
}
```

**Key Characteristics:**
- **Single process** — main + renderer share memory
- **No HTTP server** — RPC over Electron IPC
- **Built-in IPC** via electron.ipcMain/ipcRenderer
- Each Electron process gets **its own** ElectronHost instance

### BackendServer (Separate Process)
**File:** `full-stack-tests/core/src/backend/BackendServer.ts`

```typescript
export const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

async function startServer() {
  // 1. HTTP Server on fixed port
  const webEditServer = new WebEditServer(rpcConfig.protocol);
  const httpServer = await webEditServer.initialize(backendPort);
  console.log(`Web backend listening on port ${backendPort}`);
  
  // 2. LocalhostIpcHost (separate from Electron)
  await LocalhostIpcHost.startup({ 
    iModelHost, 
    localhostIpcHost: { noServer: true } 
  });
  
  // 3. Shared cacheDir
  iModelHost.cacheDir = path.join(__dirname, ".cache");
}
```

**Key Differences:**
| Feature | ElectronHost | BackendServer |
|---------|--------------|---------------|
| Process | Main Electron | Node.js child |
| Communication | Electron IPC | HTTP + WS |
| Port Binding | None (IPC-only) | **Fixed port 5010** |
| Cache Dir | `.cache` (shared) | `.cache` (shared) |
| Startup | `ElectronHost.startup()` | `LocalhostIpcHost.startup()` |

---

## 3. IPC ARCHITECTURE: Frontend ↔ Backend Communication

### Electron Mode (In-Process)
**Path:** Renderer → Main Process IPC

```typescript
// Renderer script (src/electron/RunElectronSession.ts line 135-150)
window._CertaSendToBackend = async function(name, args) {
  const response = await ipcRenderer.invoke("certa-callback", {
    token: bridgeToken,           // ← Session token auth
    name: name,
    args: args,
  });
  if (response.error) throw err;
  return response.result;
};

// Main process handler (line 51-60)
ipcMain.handle("certa-callback", async (_event, payload) => {
  if (payload.token !== bridgeToken) throw new Error("Invalid token");
  const result = await executeRegisteredCallback(payload.name, payload.args);
  return { result };
});
```

**Communication Path:**
1. **Test running in renderer** calls `ipcRenderer.invoke("certa-callback", payload)`
2. **Main process** receives in `ipcMain.handle()`
3. **Executes callback** from `callbackRegistry` (Certa bridge)
4. **Returns result** back to renderer

**RPC Calls (TestRpcInterface):**
```typescript
// src/frontend/TestSnapshotConnection.ts
export class TestSnapshotConnection extends SnapshotConnection {
  public static async openFile(filePath: string) {
    const openResponse = await TestRpcInterface.getClient().openSnapshot(filePath);
    //                                        ↑ RPC call via in-process IPC
    const connection = new TestSnapshotConnection(openResponse);
    return connection;
  }
}
```

### Web/Chrome Mode (Cross-Process)
**File:** `src/frontend/vitest.setup.ts` line 95-103

```typescript
const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

if (!ProcessDetector.isElectronAppFrontend) {
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: `http://localhost:${backendPort}`,  // ← FIXED PORT
  };
  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);
}
```

**Communication Path:**
1. **Frontend test** → RPC call via HTTP POST
2. **BackendServer** on port 5010 receives
3. **RpcImpl** handler executes (file opening, DB operations)
4. **HTTP response** returned to frontend

**Key Insight:** Frontend must connect to **exactly port 5010** (or env var)

---

## 4. FILE LOCKING & SQLITE

### .bim File Opening Patterns

**SnapshotDb.openFile() — READ-ONLY**
```typescript
// src/backend/RpcImpl.ts line 31-39
public async openSnapshot(filePath: string): Promise<IModelConnectionProps> {
  let resolvedFileName: string | undefined = filePath;
  if (IModelHost.snapshotFileNameResolver) {
    resolvedFileName = IModelHost.snapshotFileNameResolver.tryResolveFileName(filePath);
  }
  return SnapshotDb.openFile(resolvedFileName).getConnectionProps();
  //      ↑ SnapshotDb = read-only SQLite database
}
```

- **SnapshotDb** opens `.bim` files **read-only**
- No exclusive locks required for reading
- **Multiple processes CAN read the same .bim file** ✓

**StandaloneDb.openFile() — READ-WRITE**
```typescript
// src/backend/RpcImpl.ts line 76-80
removeViewStore = SnapshotDb.onOpen.addListener((dbName) => {
  const db = StandaloneDb.openFile(dbName, OpenMode.ReadWrite);
  //              ↑ Opens for WRITE during test
  db.views.saveDefaultViewStore({...});
  db.close();
});
```

- **StandaloneDb** opens files in **read-write mode**
- Uses SQLite **exclusive locks**
- **Cannot be opened by 2+ processes simultaneously** ✗

### Asset Resolver & File Paths

**BackendTestAssetResolver:** `src/backend/BackendServer.ts` line 272-286
```typescript
export class BackendTestAssetResolver extends FileNameResolver {
  public override tryResolveFileName(inFileName: string): string {
    if (path.isAbsolute(inFileName)) return inFileName;
    // ← Resolves relative paths to SHARED directory
    return path.join(__dirname, "../../../../core/backend/lib/cjs/test/assets/", inFileName);
  }
  
  public override tryResolveKey(fileKey: string): string | undefined {
    switch (fileKey) {
      case "test-key": return this.tryResolveFileName("test.bim");
      case "test2-key": return this.tryResolveFileName("test2.bim");
    }
  }
}
```

**Asset Files:**
- Location: `core/backend/lib/cjs/test/assets/`
- Contains **19 .bim files** (test.bim, test2.bim, ElementAspectTest.bim, etc.)
- Opened **read-only** via SnapshotDb in most cases
- **Same files referenced by all tests** ✓ (shared)

### Cache Directory & Conflicts

**Shared Cache Directory:**
```typescript
// backend.ts line 49 & BackendServer.ts line 241
iModelHost.cacheDir = path.join(__dirname, ".cache");
// → `.../full-stack-tests/core/lib/backend/.cache`
```

**Multiple processes writing to `.cache` simultaneously:**
- Tile cache (Sqlite)
- Cloud cache metadata
- **Database locks can contend** ✗

---

## 5. GLOBAL SINGLETONS & CONFLICTS

### IModelHost (Static Singleton)
```typescript
// @itwin/core-backend/lib/cjs/IModelHost.ts
export class IModelHost {
  private static _instance?: IModelHost;
  private static _startupCalled = false;
  
  public static startup(opts?: IModelHostOptions): Promise<void> {
    // Can only startup ONCE per process
    if (IModelHost._startupCalled) throw Error("Already started");
  }
}
```

**Per-Process Limit:** 1 startup per Node process

**Blocking Multi-Process Parallelization:**
- Process 1 starts IModelHost → cacheDir = `.cache`, nativeDb initialized
- Process 2 starts IModelHost → **same cacheDir**, contending SQLite connections

### ElectronHost (Static Singleton)
```typescript
// core/electron/src/backend/ElectronHost.ts
export class ElectronHost {
  private static _ipc: ElectronIpc;
  private static _mainWindow?: BrowserWindow;
  
  public static async startup(opts: ElectronHostOpts) {
    // Cannot have 2+ ElectronHost instances per app.js
  }
}
```

**Blocking:** 
- Only 1 Electron app per OS user per port
- Cannot start 2 Electron processes with same BrowserWindow

### IModelApp (Frontend Singleton)
```typescript
// @itwin/core-frontend/lib/cjs/IModelApp.ts
export class IModelApp {
  private static _initialized = false;
  
  public static async startup(opts: IModelAppOptions) {
    if (IModelApp.initialized) return;  // Idempotent
    // One app instance per renderer
  }
}
```

**Blocking:**
- Electron renderer = 1 app process
- Can't parallelize frontend tests in same renderer

### BentleyCloudRpcManager (Global Registry)
```typescript
// @itwin/core-common/lib/cjs/rpc/RpcManager.ts
export abstract class RpcManager {
  private static _clients: Map<string, RpcInterface> = new Map();
  
  static initializeClient(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]) {
    // Sets GLOBAL RPC endpoint
    // Web: http://localhost:5010
    // Electron: IPC to main process
  }
}
```

**Conflict:**
- Both processes try to initialize with same port
- **Port 5010 is locked by first process** → second fails

---

## 6. PORT BINDINGS & RESOURCE EXHAUSTION

### Web Backend Port
```typescript
// src/frontend/vitest.setup.ts line 95
const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

// src/backend/BackendServer.ts line 246
const httpServer = await webEditServer.initialize(backendPort);
console.log(`Web backend for full-stack-tests listening on port ${backendPort}`);
```

**Conflict if 2+ processes started:**
- Process 1: `http://localhost:5010` ✓
- Process 2: `http://localhost:5010` → **EADDRINUSE** ✗

### Electron IPC Ports
```typescript
// Electron IPC uses named pipes (Windows) or Unix sockets (Mac/Linux)
// Not directly port-based, but single renderer per main process
```

---

## 7. TEMP FILES & STATE LEAKAGE

### HTML Test Runner Temp File
```typescript
// src/electron/RunElectronSession.ts line 110
const tempHtmlPath = path.join(__dirname, "..", "..", "lib", "electron", "_test-runner.html");
fs.writeFileSync(tempHtmlPath, html, "utf8");
```

**Conflict:**
- Process 1 writes `_test-runner.html`
- Process 2 overwrites it → Process 1's renderer sees wrong HTML
- Test results mixed/race conditions

### Session Token
```typescript
// src/electron/RunElectronSession.ts line 40
const bridgeToken = crypto.randomUUID();  // Per-process
ipcMain.handle("certa-callback", async (_event, payload) => {
  if (payload.token !== bridgeToken) throw new Error("Invalid token");
});
```

**Each process has unique token** → prevents cross-process interference ✓

---

## CONCRETE PARALLELIZATION BLOCKERS

| Blocker | Scope | Impact | Workaround |
|---------|-------|--------|-----------|
| **Port 5010** | HTTP server | 2nd process fails to bind | Use unique ports per process |
| **IModelHost.startup()** | Singleton | Can't startup 2x per process | Use worker processes, not threads |
| **`.cache` directory** | SQLite locks | Contending DB connections | Use separate cache dirs or in-memory |
| **ElectronHost** | Singleton | 1 main process per app | Each Electron instance separate |
| **_test-runner.html** | File I/O | Render race conditions | Use separate temp dirs |
| **IModelApp singleton** | Renderer | 1 per BrowserWindow | Can't parallelize in same renderer |
| **EditCommandAdmin registration** | Global module state | Conflicts on re-register | Module loaded once per process |
| **test.bim/.cache file locks** | Write operations | SQLite exclusive locks | Don't run write-heavy tests parallel |

---

## ARCHITECTURE DIAGRAM

```
╔═══════════════════════════════════════════════════════════════════╗
║                      ELECTRON SINGLE-PROCESS                      ║
╚═══════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│ Electron Main Process (Backend + IPC)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ IModelHost Singleton                      │              │
│  │ - cacheDir: .../lib/backend/.cache       │              │
│  │ - snapshotFileNameResolver: Assets       │              │
│  │ - authorizationClient: ElectronMainAuth  │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ ElectronHost Singleton                    │              │
│  │ - ipcMain handler                         │              │
│  │ - rpcInterfaces: registered               │              │
│  │ - EditCommandAdmin: global registry       │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ ipcMain (Electron Core)                   │              │
│  │ - "certa-callback" handler                │              │
│  │ - bridgeToken: random UUID                │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
          ↑ IPC (Electron named pipes/Unix sockets)
          ↓ In-process (shared memory)
┌─────────────────────────────────────────────────────────────┐
│ Electron Renderer (Frontend + Tests)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ IModelApp Singleton                       │              │
│  │ - ipcSession: LocalhostIpcApp (disabled)  │              │
│  │ - RpcManager: Electron IPC transport      │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ Test Suite (Vitest/Mocha harness)         │              │
│  │ - TestSnapshotConnection.openFile()       │              │
│  │ - IPC → ipcRenderer.invoke()               │              │
│  │ - Waits for result                         │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

**vs. Web Mode:**
```
Frontend (port 3000) ──HTTP POST──→ BackendServer (port 5010)
```

---

## SUMMARY: KEY BLOCKERS FOR PARALLELIZATION

1. **Singleton State**: `IModelHost`, `ElectronHost`, `IModelApp` cannot be instantiated 2+ times per process
2. **Port Conflict**: HTTP backend on fixed port 5010 (hard to parallelize)
3. **File Locks**: `.cache` SQLite directory has exclusive locks when tests write
4. **Shared Asset Files**: test.bim, test2.bim in shared `core/backend/lib/cjs/test/assets/`
5. **Electron Process Limit**: 1 main + 1 renderer per app instance
6. **Temp File Collisions**: `_test-runner.html` shared path (race conditions)
7. **IPC Bridge Token**: Single token per main process (could isolate parallel renderers)

**To parallelize Electron tests, you would need to:**
- Spawn independent Electron instances (e.g., separate npm script)
- Each with unique port range, temp dirs, cache dirs
- Coordinate process management (e.g., cluster module)
- Risk of resource exhaustion (memory per Electron app ~200MB+)

