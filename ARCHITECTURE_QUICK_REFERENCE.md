# @itwin/vitest-certa-bridge Architecture Quick Reference

## Two Execution Modes

### Mode 1: Chrome/Playwright (vitest.config.mts)

```
Host Machine:

  Vitest + Vite Dev Server (port 3010)
  ├─ BridgeInit.js loaded → register callbacks
  ├─ /ipc WebSocket proxy configured → localhost:5010
  ├─ /__certa_bridge HTTP middleware ready
  │
  ├─ Browser (Playwright Chromium)
  │  ├─ Test code: await executeBackendCallback("name", args)
  │  ├─ HTTP: fetch("/__certa_bridge", {...})
  │  ├─ Response: { result } or { error }
  │  └─ IPC: LocalhostIpcApp.connect("ws://...") → :5010
  │
  └─ BackendServer (port 5010) [SEPARATE PROCESS]
     ├─ RPC server (HTTP + RPC)
     ├─ IPC host (WebSocket)
     ├─ IModelHost, EditCommandAdmin
     └─ Start: node lib/backend/BackendServer.js
```

**Key:** Single browser, HTTP bridge, backend runs separately

---

### Mode 2: Electron (vitest.electron.config.mts)

```
Vitest (pool: "forks"):
  RunElectronFrontendTests.ts
  ├─ Discover: lib/frontend/**/*.test.js
  ├─ Shard: Round-robin into N groups (default 4)
  └─ For each shard:
     └─ spawn Electron RunElectronSession.js
        ├─ ELECTRON_SHARD_ID
        ├─ ELECTRON_CACHE_DIR
        └─ Environment variables

Parallel Execution (4 shards default):
  ┌─ Shard 0 ─┬─ Shard 1 ─┬─ Shard 2 ─┬─ Shard 3 ─┐
  │ Electron  │ Electron  │ Electron  │ Electron  │
  │ Main + WW │ Main + WW │ Main + WW │ Main + WW │
  │ Backend   │ Backend   │ Backend   │ Backend   │
  │ Tests     │ Tests     │ Tests     │ Tests     │
  │ (isolated)│ (isolated)│ (isolated)│ (isolated)│
  └───────────┴───────────┴───────────┴───────────┘
       exit        exit        exit        exit
  
  Vitest aggregates results
```

**Key:** Isolated Electron per shard, IPC bridge, parallel execution

