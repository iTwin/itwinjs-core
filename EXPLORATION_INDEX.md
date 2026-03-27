# Vitest-Certa-Bridge Exploration Index

## 📋 Generated Documentation

Three comprehensive guides have been created to support your redesign planning:

### 1. **VITEST_CERTA_EXPLORATION.md** (816 lines) ⭐ START HERE
   - **What it is:** Complete technical deep-dive of the entire system
   - **Contents:**
     - Executive summary
     - Package structure and directory trees
     - package.json contents
     - Main plugin source (certaBridge function, 140 lines)
     - All supporting utilities (client, callbackRegistry, electron-main, nullLoader, preferEsm)
     - Full Chrome config (vitest.config.mts, 130 lines)
     - Full Electron config (vitest.electron.config.mts, 23 lines)
     - RunElectronFrontendTests.ts orchestrator (186 lines)
     - RunElectronSession.ts first/last 50 lines (531 lines total)
     - Backend files (backend.ts, BackendServer.ts, BridgeInit.ts)
     - certaBackend.ts and callback system
     - Type definitions and current state analysis
   - **Best for:** Understanding the full system comprehensively

### 2. **ARCHITECTURE_QUICK_REFERENCE.md** (59 lines)
   - **What it is:** Visual ASCII diagrams and quick lookup
   - **Contents:**
     - Chrome mode architecture (HTTP bridge)
     - Electron mode architecture (IPC bridge with parallel shards)
     - Plugin module structure
     - Data flow diagrams
     - Configuration comparison table
     - File checklist
     - Token & security overview
   - **Best for:** Quick reference, architectural overview, presentations

### 3. **FILE_MANIFEST.md** (305 lines)
   - **What it is:** Detailed file-by-file inventory with line counts
   - **Contents:**
     - Core plugin package (9 source files, 521 lines total)
     - Test configurations (2 files)
     - Backend initialization (3 main files, 404 lines)
     - Test orchestration (2 files, 717 lines)
     - Test files inventory (80+ test files, 1000+ test cases)
     - Complete file tree
     - Key metrics
     - Most critical files for redesign (ranked)
     - Build steps and execution entry points
   - **Best for:** Identifying what to modify, understanding module dependencies

---

## 🎯 Key Findings Summary

### System Overview
- **Purpose:** Vitest plugin enabling full-stack browser tests with backend callbacks
- **Replaces:** Legacy @itwin/certa framework
- **Two modes:** Chrome/Playwright (HTTP bridge) and Electron (IPC bridge)
- **Test count:** 80+ test files, 1000+ test cases

### Core Components
| Component | Location | Lines | Purpose |
|-----------|----------|-------|---------|
| Plugin | plugin.ts | 140 | HTTP middleware + token injection |
| Chrome Config | vitest.config.mts | 130 | Browser test setup |
| Electron Orchestrator | RunElectronFrontendTests.ts | 186 | Shard spawner |
| Electron Session | RunElectronSession.ts | 531 | Test runner |
| Chrome Backend | BackendServer.ts | 295 | RPC server |
| Electron Backend | backend.ts | 79 | ElectronHost init |

### Critical Insights
1. **Plugin is minimal:** Only 140 lines; main work is middleware + token management
2. **Two distinct paths:** Chrome mode (single browser) vs Electron mode (parallel shards)
3. **Isolated shards:** Each Electron shard has independent backend state
4. **Bridge token security:** Per-session UUID prevents unauthorized callbacks
5. **Dual package:** Supports both CJS and ESM via dual builds

---

## 🚀 How to Use These Docs

### For Understanding Architecture
1. Read **ARCHITECTURE_QUICK_REFERENCE.md** (5 min read)
2. Study the data flow diagrams
3. Refer to execution modes comparison table

### For Implementation Details
1. Start with **VITEST_CERTA_EXPLORATION.md** section 3 (plugin.ts)
2. Review **FILE_MANIFEST.md** for critical files (ranked)
3. Deep-dive into specific files as needed

### For Planning Redesign
1. Review **FILE_MANIFEST.md** "Most Critical Files" section
2. Identify dependencies using file tree
3. Use section 14 ("Current State & Limitations") for pain points
4. Reference section 15 for key redesign candidates

### For Debugging
1. **FILE_MANIFEST.md** section "Detailed Breakdown" shows line ranges
2. **ARCHITECTURE_QUICK_REFERENCE.md** has data flow diagrams
3. **VITEST_CERTA_EXPLORATION.md** has complete code listings

---

## 📂 Source Files Summary

### Highest Priority (must understand for redesign)
```typescript
tools/vitest-certa-bridge/src/plugin.ts                 // HTTP bridge logic
full-stack-tests/core/vitest.config.mts                 // Chrome config
full-stack-tests/core/vitest.electron.config.mts        // Electron config
full-stack-tests/core/src/electron/RunElectronFrontendTests.ts // Orchestrator
full-stack-tests/core/src/electron/RunElectronSession.ts       // Session runner
full-stack-tests/core/src/backend/BackendServer.ts             // Chrome backend
full-stack-tests/core/src/backend/backend.ts                   // Electron backend
full-stack-tests/core/src/backend/BridgeInit.ts                // Bridge init
```

### Secondary Priority (should understand)
```typescript
tools/vitest-certa-bridge/src/electron-main.ts         // Electron IPC
tools/vitest-certa-bridge/src/client.ts                // Browser API
tools/vitest-certa-bridge/src/callbackRegistry.ts      // Callback system
```

### Nice to Have
```typescript
tools/vitest-certa-bridge/src/nullLoader.ts            // Vite plugin
tools/vitest-certa-bridge/src/preferEsm.ts             // Vite plugin
full-stack-tests/core/src/certa/certaBackend.ts        // Auth callbacks
```

---

## 🔍 Finding Specific Information

### "How does Chrome mode work?"
→ **ARCHITECTURE_QUICK_REFERENCE.md** section 1 + **VITEST_CERTA_EXPLORATION.md** sections 4-5

### "How does test sharding work?"
→ **VITEST_CERTA_EXPLORATION.md** sections 7-8

### "Where's the HTTP bridge middleware?"
→ **VITEST_CERTA_EXPLORATION.md** section 3, lines 85-117 (plugin.ts)

### "How do backend callbacks get executed?"
→ **VITEST_CERTA_EXPLORATION.md** section 3 or **ARCHITECTURE_QUICK_REFERENCE.md** "Data Flow"

### "What files should I modify?"
→ **FILE_MANIFEST.md** "Most Critical Files (for redesign)"

### "How many lines of code are we talking about?"
→ **FILE_MANIFEST.md** "Key Metrics"

### "What's the full test suite structure?"
→ **FILE_MANIFEST.md** "Complete File Tree"

---

## 📊 Quick Stats

| Metric | Count |
|--------|-------|
| Plugin source files | 8 |
| Plugin total lines | 521 |
| Test config files | 2 |
| Backend files (Chrome) | 2 |
| Backend files (Electron) | 1 |
| Orchestration files | 2 |
| Frontend test files | 80+ |
| Total test cases | 1000+ |
| Peer dependencies | 3 (vite, vitest, electron) |

---

## 🛠️ Setup for Exploration

All files are located in the repository root:
```bash
# Read comprehensive guide
cat VITEST_CERTA_EXPLORATION.md

# View architecture diagrams
cat ARCHITECTURE_QUICK_REFERENCE.md

# See file inventory
cat FILE_MANIFEST.md
```

### Source code locations
```bash
# Plugin package
tools/vitest-certa-bridge/src/

# Test configurations
full-stack-tests/core/vitest.config.mts
full-stack-tests/core/vitest.electron.config.mts

# Backend
full-stack-tests/core/src/backend/

# Test orchestration
full-stack-tests/core/src/electron/

# Test files
full-stack-tests/core/src/frontend/
```

---

## ✅ Pre-Redesign Checklist

Before starting your redesign, ensure you:

- [ ] Read **ARCHITECTURE_QUICK_REFERENCE.md** (understand two modes)
- [ ] Review **VITEST_CERTA_EXPLORATION.md** section 14 (current limitations)
- [ ] Identify priority pain points in your redesign
- [ ] Check **FILE_MANIFEST.md** for dependency graph
- [ ] Understand token security model
- [ ] Know the shard isolation mechanism
- [ ] Review build outputs (lib/cjs vs lib/esm)

---

## 📝 Notes for Your Review

### Chrome Mode Strengths
✅ Simple: HTTP bridge, minimal setup
✅ Fast startup: Only one browser needed
✅ Familiar: Standard fetch API

### Chrome Mode Challenges
❌ Single browser: No parallelism
❌ Manual backend start: Must run BackendServer.js separately
❌ No hot-reload: Backend changes require restart

### Electron Mode Strengths
✅ Parallel: 4 concurrent shards (default)
✅ Isolated: Each shard has independent backend state
✅ Scalable: Add/remove shards via ELECTRON_SHARD_COUNT

### Electron Mode Challenges
❌ Slow startup: 3-5s per shard (Electron launch overhead)
❌ Sequential within shard: All tests run serially
❌ Complex runner: 531 lines of custom test execution logic

### Overall Recommendations for Redesign
1. **Keep bridge token security** — it works
2. **Consider worker threads** for Chrome mode parallelism
3. **Consolidate test runners** — RunElectronSession.ts has custom vitest reimplementation
4. **Simplify backend startup** — single unified backend for both modes
5. **Improve test discovery** — dynamically discover instead of pre-compile

---

## 📞 Questions This Documentation Answers

1. ✅ What does the vitest-certa-bridge plugin do?
2. ✅ How do browser tests communicate with Node.js backend?
3. ✅ What's the difference between Chrome and Electron modes?
4. ✅ How are Electron tests parallelized?
5. ✅ What files need to be modified for a redesign?
6. ✅ Where is the HTTP bridge middleware?
7. ✅ How does token-based security work?
8. ✅ What are current performance bottlenecks?
9. ✅ What's the complete file structure?
10. ✅ How do backend callbacks get registered and executed?

---

## 🎓 Learning Path

**5-minute overview:**
- ARCHITECTURE_QUICK_REFERENCE.md

**30-minute dive:**
- VITEST_CERTA_EXPLORATION.md sections 1-5
- FILE_MANIFEST.md sections 1-3

**Deep technical review (2 hours):**
- Full VITEST_CERTA_EXPLORATION.md
- Study plugin.ts source code directly
- Examine RunElectronSession.ts in detail

**Ready for redesign:**
- Refer to FILE_MANIFEST.md "Most Critical Files"
- Cross-reference with VITEST_CERTA_EXPLORATION.md
- Review specific sections for implementation details

---

## 📄 Document Metadata

| Document | Lines | Created | Purpose |
|----------|-------|---------|---------|
| VITEST_CERTA_EXPLORATION.md | 816 | 2024-03-20 | Comprehensive technical guide |
| ARCHITECTURE_QUICK_REFERENCE.md | 59 | 2024-03-20 | Visual diagrams & quick reference |
| FILE_MANIFEST.md | 305 | 2024-03-20 | File inventory & organization |
| **Total** | **1,180** | | **Complete system documentation** |

---

**Happy exploring! Use these docs as your north star for the redesign.** 🚀
