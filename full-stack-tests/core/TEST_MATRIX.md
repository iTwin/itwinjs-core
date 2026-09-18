# Full-stack core test matrix

This matrix records which `full-stack-tests/core` tests run in each Certa runtime during the staged Vitest migration. The source bundle is shared; a runtime-specific entry means the suite is intentionally skipped in the other runtime, not deleted.

## Runner commands

| Scope | Chrome | Electron |
| --- | --- | --- |
| Normal | `npm run -s test:chrome` | `npm run -s test:electron` |
| Integration | `npm run -s test:integration:chrome` | `npm run -s test:integration:electron` |
| Performance | `npm run -s test:performance:chrome` | `npm run -s test:performance:electron` |

Normal commands exclude `#integration` and `#performance`. Integration and performance commands select those tags explicitly. Electron performance collects only `standalone/QueryExtents.test.ts`, the owner of all nine performance tests, instead of creating tester frames for unrelated skipped suites. Update that file selection if performance coverage moves or expands to other files. Azurite is started by the surrounding package scripts where required.

## 5a decisions

The following suites are Chrome-only because they validate transport-independent frontend behavior or expensive pixel/GPU behavior already covered by the Chrome renderer. They remain in the Chrome bundle and are reported as skipped by Certa in Electron through the framework-neutral `describe.skip` conditional.

- `src/frontend/map/BackgroundMap.test.ts` — pixel assertions over background-map rendering.
- `src/frontend/map/PlanProjection.test.ts` — pixel assertions over plan projection rendering.
- `src/frontend/map/PlanarClipMask.test.ts` — pixel assertions over planar clip-mask rendering.
- `src/frontend/standalone/BlankConnection.test.ts` — blank-connection API and mock viewport behavior.
- `src/frontend/standalone/Categories.test.ts` — category/subcategory RPC behavior.
- `src/frontend/standalone/CodeSpecs.test.ts` — CodeSpec RPC behavior.
- `src/frontend/standalone/ECSqlAst.test.ts` — ECSQL parser/AST behavior.
- `src/frontend/standalone/Elements.test.ts` — element and placement RPC behavior.
- `src/frontend/standalone/ModelState.test.ts` — model-state loading and serialization behavior.
- `src/frontend/standalone/SchemaLocator.test.ts` — schema RPC locator behavior.
- `src/frontend/standalone/SubCategoriesCache.test.ts` — subcategory cache behavior.
- `src/frontend/standalone/ViewState.test.ts` — ViewState and ViewState2d behavior.

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
- `src/frontend/hub/HyperModeling.test.ts` — the key-in marker-display test skips Electron because the Certa Electron path cannot locate its JSON key-in file.
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

The 44 files not listed in the exception sections are currently shared by Chrome and Electron. Existing skipped tests remain unchanged, including the four parser skips in `ECSqlAst`, the skipped `GraphicalEditingScope` test, and the flaky skipped `RenderTarget` test.

## Migration requirements

- Preserve these mode decisions while moving Electron to Vitest in 5b and Chrome to Vitest in 5c.
- Reconcile Certa and Vitest test names/counts against this matrix before removing Certa.
- Keep Electron execution serial initially; do not add PR #9094's sharding/retry runner to the migration PR.
- Revisit any Chrome-only decision if Vitest exposes a meaningful transport or renderer difference.
