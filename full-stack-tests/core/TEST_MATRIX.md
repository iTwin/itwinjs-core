# Full-stack core test matrix

This matrix records which `full-stack-tests/core` tests run in each Vitest browser runtime. The source is shared; a runtime-specific entry means the suite is intentionally skipped in the other runtime, not deleted.

## Runner commands

| Scope | Chrome | Electron |
| --- | --- | --- |
| Normal | `npm run -s test:chrome` | `npm run -s test:electron` |
| Integration | `npm run -s test:integration:chrome` | `npm run -s test:integration:electron` |
| Performance | `npm run -s test:performance:chrome` | `npm run -s test:performance:electron` |

Normal commands exclude `#integration` and `#performance`. Integration and performance commands select those tags explicitly. Both performance runners collect only `standalone/QueryExtents.test.ts`, the owner of all nine performance tests, instead of creating tester frames for unrelated skipped suites. Update that file selection if performance coverage moves or expands to other files. Azurite is started by the surrounding package scripts where required.

## Chrome-only suite decisions

Only the three map suites are Chrome-only. They compare rendered pixels, which both runtimes produce with the same Chromium WebGL, so running them in Electron as well would repeat expensive graphics tests without exercising a different renderer. They remain in the shared test source but are selected only by the Chrome Vitest project; the Electron project excludes them rather than reporting no-op skips.

- `src/frontend/map/BackgroundMap.test.ts` — pixel assertions over background-map rendering. Needs `TEST_BING_MAPS_KEY` and `TEST_MAPBOX_KEY`.
- `src/frontend/map/PlanProjection.test.ts` — pixel assertions over plan projection rendering. Needs the same map keys.
- `src/frontend/map/PlanarClipMask.test.ts` — pixel assertions over planar clip-mask rendering.

Both Vitest configs pass `IMJS_*` and `TEST_*` variables to the renderer. Running these suites in Electron only needs them removed from the Electron project's `exclude` list and their `describeChrome` guard dropped.

No test logic was removed. The Electron run retains the Electron-specific, IPC, tile, and renderer coverage listed below.

## Electron-only suites already present

These files already guard their tests with `ProcessDetector.isElectronAppFrontend` and remain Electron-only.

- `src/frontend/app/NativeApp.test.ts`
- `src/frontend/standalone/BriefcaseConnection.test.ts`
- `src/frontend/standalone/CatalogConnection.test.ts`
- `src/frontend/standalone/ITwinError.test.ts`
- `src/frontend/standalone/OpenStandalone.test.ts`
- `src/frontend/standalone/SnapshotConnection.test.ts`

## Mixed files and test-level conditions

These files contain tests or setup that differ by runtime. File-level counts must not be used to classify them.

- `src/frontend/_Setup.test.ts` — initializes Bentley Cloud RPC and the backend health test only for Chrome; cleanup hooks apply to both runtimes.
- `src/frontend/hub/HyperModeling.test.ts` — the key-in marker-display test retains its existing Electron skip.
- `src/frontend/hub/IModelConnection.test.ts` — the repeated-open test is Chrome-only because the behavior is not valid over Electron IPC.
- `src/frontend/standalone/ECSqlQuery.test.ts` — the frontend-restart test skips the browser and therefore runs in Electron.
- `src/frontend/standalone/tile/TileIO.test.ts` — worker decoding and Electron frontend startup/shutdown are conditional.
- `src/frontend/standalone/tile/VerifyTileVersionInfo.test.ts` — Electron frontend startup/shutdown is conditional.

The `isMobileAppFrontend` guards in `BriefcaseTxns`, `EditTool`, `GraphicalEditingScope`, `ModelChangeMonitor`, and `WatchForChanges` are not Chrome/Electron partitions; both current runners are non-mobile.

## Integration suites

| Suite | Chrome | Electron | Notes |
| --- | --- | --- | --- |
| `hub/ExternalTextures.test.ts` | run | run | Cloud integration |
| `hub/HyperModeling.test.ts` | run | run, one test skipped | Cloud integration; see mixed conditions |
| `hub/IModelConnection.test.ts` | run | run, one test skipped | Cloud integration; see mixed conditions |
| `hub/ScheduleScript.test.ts` | run | run | Cloud integration |
| `hub/SectionDrawing.test.ts` | run | run | Cloud integration |
| `hub/SheetViewState.test.ts` | run | run | Cloud integration |
| `map/BackgroundMap.test.ts` | run | skip | Chrome-only pixel coverage |
| `map/PlanProjection.test.ts` | run | skip | Chrome-only pixel coverage |
| `map/PlanarClipMask.test.ts` | run | skip | Chrome-only pixel coverage |
| `standalone/BriefcaseConnection.test.ts` | skip | run | Existing Electron guard |
| `standalone/RealityDataAccess.test.ts` | run | run | Cloud integration |

## Performance suite

| Suite | Chrome | Electron | Notes |
| --- | --- | --- | --- |
| `standalone/QueryExtents.test.ts` | run | run | Keep both until performance ownership is revisited separately. |

## Remaining normal suites

The 53 files not listed in the exception sections are currently shared by Chrome and Electron. Existing skipped tests remain unchanged, including the four parser skips in `ECSqlAst`, the skipped `GraphicalEditingScope` test, and the flaky skipped `RenderTarget` test.

## Runner requirements

- Preserve these mode decisions for the Chrome and Electron Vitest projects.
- Reconcile Vitest test names/counts against this matrix and the pre-migration baseline.
- Keep Electron execution serial; do not add PR #9094's sharding/retry runner.
- Revisit any Chrome-only decision if Vitest exposes a meaningful transport or renderer difference.
