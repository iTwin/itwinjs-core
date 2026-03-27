================================================================================
                    VITEST-CERTA-BRIDGE EXPLORATION DOCS
                           Quick Start Guide
================================================================================

WHAT: Complete technical analysis of @itwin/vitest-certa-bridge plugin and 
      full-stack-tests/core test infrastructure. Two execution modes: 
      Chrome/Playwright (HTTP bridge) and Electron (IPC bridge).

WHY: Prepare for redesign by understanding:
     - Complete architecture and data flows
     - File structure and dependencies  
     - Current strengths and limitations
     - Performance characteristics

HOW: Start with EXPLORATION_INDEX.md (navigation guide)

================================================================================
                              QUICK FACTS
================================================================================

System Purpose:     Vitest plugin enabling full-stack browser tests with 
                   Node.js backend callbacks (replaces legacy @itwin/certa)

Plugin Size:        521 lines (plugin.ts = 140 lines core)

Test Count:         80+ test files, 1000+ test cases

Two Modes:
  • Chrome:    Single browser, HTTP bridge, separate backend server
  • Electron:  4 parallel shards, IPC bridge, in-process backend

Critical Files:
  1. plugin.ts (140) - HTTP middleware + token injection
  2. RunElectronFrontendTests.ts (186) - Orchestrator
  3. RunElectronSession.ts (531) - Test runner
  4. BackendServer.ts (295) - Chrome backend
  5. vitest.config.mts (130) - Chrome config

Total Lines Generated:  1,482 lines of documentation

================================================================================
                            START HERE (5 MIN)
================================================================================

Read in this order:

1. EXPLORATION_INDEX.md
   └─ Navigation guide, learning paths, FAQ

2. ARCHITECTURE_QUICK_REFERENCE.md
   └─ ASCII diagrams, mode comparison, data flows

3. FILE_MANIFEST.md
   └─ File inventory, line counts, critical files ranked

4. VITEST_CERTA_EXPLORATION.md
   └─ Complete technical deep-dive (sections 1-5 = 30 min overview)

================================================================================
                             FILE GUIDE
================================================================================

VITEST_CERTA_EXPLORATION.md (816 lines) ⭐ MAIN GUIDE
├─ Complete technical deep-dive
├─ All source code reviewed
├─ Packages structure & trees
├─ Full configuration files
├─ Both execution modes
├─ Data flows & diagrams
└─ Current limitations

EXPLORATION_INDEX.md (302 lines)
├─ Navigation to all docs
├─ 5-min/30-min/2-hour learning paths
├─ Pre-redesign checklist
├─ Key findings summary
└─ FAQ with document links

ARCHITECTURE_QUICK_REFERENCE.md (59 lines)
├─ ASCII architecture diagrams
├─ Chrome vs Electron comparison
├─ Data flow visualizations
├─ Quick lookup reference
└─ Security & token overview

FILE_MANIFEST.md (305 lines)
├─ File-by-file inventory
├─ Line counts & organization
├─ Most critical files ranked
├─ Build steps & entry points
└─ Environment variables reference

README_EXPLORATION.txt (this file)
└─ Quick start guide

================================================================================
                          SOURCE CODE PATHS
================================================================================

Plugin:
  tools/vitest-certa-bridge/src/
  ├── plugin.ts (140 lines) ⭐ CORE
  ├── client.ts, callbackRegistry.ts
  ├── electron-main.ts
  └── nullLoader.ts, preferEsm.ts

Configs:
  full-stack-tests/core/
  ├── vitest.config.mts (130 lines) ⭐ Chrome
  └── vitest.electron.config.mts (23 lines) ⭐ Electron

Backend:
  full-stack-tests/core/src/backend/
  ├── BridgeInit.ts (30 lines) ⭐ Chrome init
  ├── BackendServer.ts (295 lines) ⭐ Chrome server
  └── backend.ts (79 lines) ⭐ Electron init

Orchestration:
  full-stack-tests/core/src/electron/
  ├── RunElectronFrontendTests.ts (186 lines) ⭐ Orchestrator
  └── RunElectronSession.ts (531 lines) ⭐ Session runner

Tests:
  full-stack-tests/core/src/frontend/
  ├── 80+ test files
  └── 1000+ test cases

================================================================================
                         EXECUTION MODES
================================================================================

CHROME MODE (vitest.config.mts):
  • Single browser (Playwright Chromium)
  • HTTP bridge: fetch("/__certa_bridge", ...)
  • Separate backend (port 5010)
  • No parallelism
  • Manual server startup required
  • Run: npx vitest

ELECTRON MODE (vitest.electron.config.mts):
  • 4 parallel isolated Electron shards
  • IPC bridge: ipcRenderer.invoke()
  • In-process backend per shard
  • State completely isolated
  • Automatic orchestration
  • Run: npx vitest -c vitest.electron.config.mts

================================================================================
                        REDESIGN PRIORITIES
================================================================================

Must Understand (HIGH):
  1. plugin.ts (140 lines) - HTTP middleware logic
  2. RunElectronFrontendTests.ts (186 lines) - Orchestrator
  3. RunElectronSession.ts (531 lines) - Test runner
  4. vitest.config.mts (130 lines) - Chrome setup
  5. BackendServer.ts (295 lines) - Backend server

Should Understand (MEDIUM):
  6. electron-main.ts (84 lines) - IPC setup
  7. client.ts (40 lines) - Browser API
  8. callbackRegistry.ts (40 lines) - Registry

Nice to Have (LOW):
  9. nullLoader.ts, preferEsm.ts - Vite plugins
  10. certaBackend.ts (30 lines) - Auth callbacks

================================================================================
                           KEY INSIGHTS
================================================================================

Strengths:
  ✓ Simple HTTP bridge (140 lines core)
  ✓ Token-based security (prevents unauthorized callbacks)
  ✓ Electron shard isolation (independent backend state)
  ✓ Dual-mode flexibility (Chrome vs Electron)

Weaknesses:
  ✗ Chrome: No parallelism (single browser only)
  ✗ Electron: Slow startup (3-5s per shard)
  ✗ Electron: Custom test runner (not real Vitest)
  ✗ Tests must pre-compile to lib/ before running

Redesign Opportunities:
  → Worker threads for Chrome parallelism
  → Unified backend (single process for both modes)
  → Use actual Vitest runner (not custom implementation)
  → Dynamic test discovery (vs pre-compile)

================================================================================
                          QUICK REFERENCE
================================================================================

Bridge Token:
  • Per-session UUID (prevents unauthorized callbacks)
  • Chrome: Injected into HTML, verified on fetch
  • Electron: Generated in main, injected into renderer

Communication:
  • Chrome: fetch("/__certa_bridge", { name, args, token })
  • Electron: ipcRenderer.invoke("certa-callback", { token, name, args })

State Isolation (Electron):
  • Each shard: separate Electron process
  • Separate cache dir (ELECTRON_CACHE_DIR)
  • Separate backend (ElectronHost, IModelHost)
  • Shared: read-only test assets (.bim files)

Performance:
  • Chrome startup: 5-10s (single browser)
  • Electron startup: 3-5s per shard × N shards
  • Test execution: ~100-500ms per test

================================================================================
                         BEFORE YOU BEGIN
================================================================================

Checklist:
  ☐ Read EXPLORATION_INDEX.md (5 min)
  ☐ Review ARCHITECTURE_QUICK_REFERENCE.md (5 min)
  ☐ Study VITEST_CERTA_EXPLORATION.md sections 14-15 (20 min)
  ☐ Identify redesign goals
  ☐ Reference FILE_MANIFEST.md for critical files
  ☐ Plan modifications

================================================================================
                         LEARNING PATHS
================================================================================

FAST TRACK (5 minutes):
  1. ARCHITECTURE_QUICK_REFERENCE.md
  2. Understanding: Basic two-mode architecture

STANDARD (30 minutes):
  1. EXPLORATION_INDEX.md
  2. VITEST_CERTA_EXPLORATION.md sections 1-5
  3. FILE_MANIFEST.md for file organization

DEEP DIVE (2 hours):
  1. Complete VITEST_CERTA_EXPLORATION.md
  2. Study plugin.ts source directly
  3. Examine RunElectronSession.ts in detail
  4. Cross-reference with FILE_MANIFEST.md

================================================================================
                           HELP SECTION
================================================================================

Q: How do browser tests communicate with the backend?
A: See VITEST_CERTA_EXPLORATION.md section "Data Flow"
   or ARCHITECTURE_QUICK_REFERENCE.md "Data Flow Diagrams"

Q: What's the difference between Chrome and Electron modes?
A: See ARCHITECTURE_QUICK_REFERENCE.md "Two Execution Modes"
   or FILE_MANIFEST.md comparison table

Q: Which files should I modify for a redesign?
A: See FILE_MANIFEST.md section "Most Critical Files (for redesign)"

Q: How is test parallelization handled?
A: See VITEST_CERTA_EXPLORATION.md sections 7-8
   or ARCHITECTURE_QUICK_REFERENCE.md "Parallel Execution"

Q: What are the current limitations?
A: See VITEST_CERTA_EXPLORATION.md section 14
   or EXPLORATION_INDEX.md "Current State & Limitations"

Q: How do I find specific information?
A: See EXPLORATION_INDEX.md "Finding Specific Information"

================================================================================
                            LOCATIONS
================================================================================

All docs in repository root:
  /Users/hoangnamle/Documents/itwinjs-core-vitest-certa-bridge/

  README_EXPLORATION.txt (this file)
  EXPLORATION_INDEX.md (navigation guide)
  ARCHITECTURE_QUICK_REFERENCE.md (diagrams)
  FILE_MANIFEST.md (file inventory)
  VITEST_CERTA_EXPLORATION.md (main guide)

Source code:
  tools/vitest-certa-bridge/src/
  full-stack-tests/core/vitest.config.mts
  full-stack-tests/core/vitest.electron.config.mts
  full-stack-tests/core/src/backend/
  full-stack-tests/core/src/electron/
  full-stack-tests/core/src/frontend/

================================================================================

Questions? Refer to EXPLORATION_INDEX.md "Help Section" or the specific 
section in VITEST_CERTA_EXPLORATION.md.

Happy exploring! 🚀

Generated: March 20, 2024
Total Documentation: 1,482 lines across 4 files

================================================================================
