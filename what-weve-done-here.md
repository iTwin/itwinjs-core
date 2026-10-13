# Gaussian splats: review guide

## Summary

This branch adds native rendering of Gaussian splat reality models to the WebGL renderer. Splat tilesets load through the existing 3D Tiles reality-model pipeline. The renderer sorts and draws them itself; it does not use Cesium's rendering engine.

- **What the option gates.** `RenderSystem.Options.enableGaussianSplats` (`@alpha`, default `false`) gates everything that draws splats: decoding splat primitives, the selection that refines a tile only once all its children are ready, GPU residency, sorting and drawing. The splat implementation is a separate chunk that only a render system with the option loads (see [Loading on demand](#loading-on-demand)). Only reality models whose tileset declares `KHR_gaussian_splatting`, and glTF read by `readGltf` (or `readGltfGraphics` and `readGltfTemplate`), draw splats; any other splat content is drawn as the points it also is.
- **What reaches every application.** Some changes to shared code apply with the option off. Each is in the area commit that needs it, and all are listed, with their commit, under [Changes that reach every application](#changes-that-reach-every-application). Two of them change level of detail, a behavior change for those applications; the rest fix failure handling or change how reality data is fetched.
- **Internal API.** All new types are `@internal`, and the public API changes only by additions (see [Shared code and public API](#shared-code-and-public-api)).
- **Visual context only.** Splats are not drawn into the pick buffers. They cannot be located, snapped to or measured. BIM stays pickable, including behind visible splats. Splat picking is deferred until a use case defines what a hit on a splat field should mean.
- **Content.** `KHR_gaussian_splatting` (ratified; plain attributes or the draft `KHR_gaussian_splatting_compression_spz_2`) and Cesium ion's content that predates that draft, in explicit 3D Tiles tilesets.
- **Comparison with CesiumJS 1.146.** Tile selection was identical at every measured pose: Redmond (ion asset 4547222, overview and detail), Boathouse (3667783, four poses) and Sandcastle (3667784, four poses), both with Cesium's dynamic and foveated screen-space error off and at Cesium's defaults. Frame pacing was comparable: both stayed at the display rate (requestAnimationFrame p95 16.7–16.8 ms) on the camera routes measured. These are single-machine measurements (Apple M4 Pro, Chromium with ANGLE on Metal). They were repeated after the design changes described below (see [Against the earlier version](#against-the-earlier-version)) and still hold.

Paths below are relative to `core/frontend/src/` unless they start with `core/`, `test-apps/` or `docs/`.

## How to review

Review the commits in order. Each one builds, lints and passes its own tests. Each is organized by what the renderer does, not by package: a change to existing iTwin.js code is in the commit that needs it, and that commit's message names it and says why. Line counts are added/removed; "tests" includes test-only fixtures and configuration.

| # | Commit | Production | Tests | Other |
| --- | --- | --- | --- | --- |
| 1 | Read splat data into a compact format | +1,637 / −79 | +303 / −1 | Notices (+28), package.json, WorkerProxy.md |
| 2 | Select splat tiles like CesiumJS | +615 / −32 | +238 | — |
| 3 | GPU residency within the tile memory limit | +795 / −19 | +148 / −1 | — |
| 4 | Sort and draw splats | +2,509 / −17 | +322 | — |
| 5 | Display Test App tool and docs | +148 / −4 (DTA) | — | Docs (+147, two screenshots) |
| 6 | This guide | — | — | — |

Reading order per commit:

1. `internal/render/GaussianSplatData.ts` (record layout, profile detection) → `workers/GaussianSplats/Spz.ts`, `Packing.ts`, `Accessors.ts` → `workers/GaussianSplats/Worker.ts` → `internal/render/GaussianSplatWorker.ts` → `internal/render/GaussianSplatModuleLoader.ts` → shared: `common/WorkerProxy.ts`, `tile/TileRequest.ts`, `tile/GltfReader.ts`, `internal/tile/RealityTileLoader.ts`, `internal/tile/RealityModelTileTree.ts`, `RealityDataSourceCesiumIonAssetImpl.ts`, `render/RenderSystem.ts`.
2. `tile/RealityTile.ts` (`computeScreenSpaceError`, `selectRefiningWhenChildrenReady`) → `internal/tile/RealityTileBoundingVolume.ts` → `tile/RealityTileTree.ts` (`refinesWhenChildrenReady`, `RealityTileCoverage`) → `tile/TileDrawArgs.ts` → `render/Scene.ts` → `internal/render/webgl/Target.ts` → `internal/tile/ConcurrencyLimiter.ts` → `internal/tile/RealityModelTileTree.ts`.
3. `tile/TileAdmin.ts` (`adjustMemoryScreenSpaceErrorFactor`) → `internal/tile/LRUTileList.ts` → `tile/RealityTile.ts` → `internal/render/webgl/GaussianSplatGeometry.ts` → `internal/render/webgl/GaussianSplatAtlas.ts` → `internal/render/webgl/Texture.ts` (`Texture2DArrayHandle`) → shared: `internal/render/webgl/System.ts`, `render/RenderMemory.ts`, `internal/render/webgl/RenderFlags.ts`.
4. `internal/render/webgl/GaussianSplatRenderer.ts` → `GaussianSplatVisibleTiles.ts` → `GaussianSplatField.ts` → `GaussianSplatSortScheduler.ts` with `workers/GaussianSplats/Sorting.ts` → `internal/render/GaussianSplatInstances.ts` → `GaussianSplatDrawPass.ts` → `GaussianSplatPrograms.ts` → `glsl/GaussianSplats.ts` → shared: `SceneCompositor.ts`, `System.ts`, `Technique.ts`, `FrameBuffer.ts`, `ClipStack.ts`, `AttributeBuffers.ts`, `Texture.ts`.
5. `docs/learning/display/GaussianSplats.md` (the user-facing contract) → `test-apps/display-test-app/src/frontend/GaussianSplatIonTool.ts`.

## 1. Data and transport

**What it does.** When the option is on, and its caller asks for splats (`GltfReaderArgs.drawsGaussianSplats`: `readGltf`, and the reality tile loader of a tileset that declares splats), `GltfReader` finds `KHR_gaussian_splatting` primitives, extracts their data (`readGaussianSplatSource`) and decodes them on a dedicated worker (`decodeGaussianSplats`). The worker packs them into `GaussianSplatData`. The render system turns that into geometry (`RenderSystem.createGaussianSplatGeometry`, implemented in commit 3).

**Key decisions.**

- *Compact 32-byte record.* Float32 mean relative to a tile origin, snorm16 quaternion, 16-bit log-scale codes, 12-bit color and opacity codes. These grids contain SPZ's 8-bit grids exactly, so SPZ content is stored without further loss. Overbright DC colors are kept. Higher spherical-harmonic bands add 16, 32 or 48 bytes per splat: one byte per coefficient and a per-splat, per-band exponent. The code scales are defined once (`gaussianSplatCodes`) and shared with the shader. The first implementation's layout used 82 bytes per splat on the GPU; at equal detail, the compact record cut a static Redmond frame's GPU time by about a quarter.
- *Two SPZ conventions, kept distinct.* `KHR_gaussian_splatting_compression_spz_2` is a draft (Khronos glTF PR 2531); it requires SPZ version 2 payloads decoded to glTF LUF coordinates, sorted by camera distance. Cesium ion's content keeps its stored coordinates and sorts by view depth, as CesiumJS 1.146 does (`usesCesiumIonDraftAdapter`). It is recognized by the draft layout (compression, no `kernel` or `colorSpace`, `COLOR_0` and no degree-0 SH attribute, as in the draft's own example) together with an SPZ version 3 payload, which every ion asset examined has; a draft-layout SPZ 2 payload is decoded in LUF. Only ion content has been exercised with real assets.
- *Reject early, with a message.* The original `KHR_spz_gaussian_splats_compression` extension, other kernels, color spaces, projections and sorting methods, instancing, implicit tiling and multiple contents are rejected with an error. One rule bounds every tile (`checkGaussianSplatDecodeLimits`): at most 2,097,152 splats, and at most 512 MiB for its input, decoded values and packed output, estimated from its SH degree. The main thread checks before it copies an SPZ payload or buffer view; the worker checks the SPZ header before it allocates the body, each accessor before it allocates its values, and stops inflating a payload that grows past the size its header declares.
- *SPZ decoding and sorting in TypeScript; no WebAssembly.* `workers/GaussianSplats/Spz.ts` decodes SPZ versions 2 and 3, inflated with `DecompressionStream`, with the reference decoder's float32 arithmetic: its packed output is bit-identical to `@spz-loader/core`'s on 33 real ion tiles (1,960,605 splats) and on random payloads of every SH degree. Plain glTF attributes are read on the worker (`Accessors.ts`), not on the main thread. The worker bundle shrank from 328 KB to 48 KB.
- *Splats only where their selection allows them.* A reality tile tree decodes splats only if its tileset declares `KHR_gaussian_splatting` in `3DTILES_content_gltf` (`RealityTileLoader.rendersGaussianSplats`), because only such a tree refines a tile once all its children are ready (section 2); in any other tree a tile and its children can be drawn together, which splats cannot be. Other trees read splat primitives as the POINTS primitives they also are, the fallback the extension provides.
- *One serialized decoder on `WorkerProxy`.* Decodes run one at a time, so packing peaks do not add up; the queue waits on the main thread. A worker whose script fails to load, or whose call takes 30 seconds, is replaced: queued decodes run on the replacement, and the running one fails with `RetryableTileContentError`, so its tile is requested again instead of becoming an empty leaf. After three consecutive worker failures a failure is permanent, so that a missing worker script does not make tiles retry forever.

**Shared code and effect on apps without splats.**

| File | Change | Effect with the option off |
| --- | --- | --- |
| `tile/GltfReader.ts` | Splat primitives, decoded only when `GltfReaderArgs.drawsGaussianSplats` asks for them; `GltfReaderArgs.resolveBuffer`; buffer and image resolution split into `resolveBuffers` and `resolveImages` | Splat primitives are read as the POINTS primitives they also are, as before. A failed buffer is still left unresolved. New: a relative buffer URI with no base URL is fetched through `resolveBuffer` when one is given. |
| `internal/tile/RealityTileLoader.ts` | Passes `system`, `shouldAbort`, `gltfBufferResolver` and `rendersGaussianSplats` to the glTF reader; warns about content that fails to load | **Applies to every reality model:** glTF tiles can be aborted when the tile is canceled, and failures are logged as warnings under `RealityData`, at most once per ten seconds, without the URL's query string. |
| `common/WorkerProxy.ts`, `workers/RegisterWorker.ts` | `WorkerProxyOptions.callTimeout`; a worker whose script fails to load is terminated and its pending calls reject | **Applies to every `WorkerProxy`:** see [Changes that reach every application](#changes-that-reach-every-application). An error a running worker throws outside an operation is left alone, as before. |
| `tile/TileRequest.ts`, `internal/tile/RetryableTileContentError.ts` | A read that fails with `RetryableTileContentError` leaves the tile unloaded, to be requested again, and counts as a failed request | Nothing throws it with the option off. The decoder bounds the retries (three consecutive worker failures), so there is no backoff. |
| `internal/tile/RealityModelTileTree.ts` | Splat tileset detection, computed once, and layout validation of the tileset and its external tilesets; `rendersGaussianSplats`; `gltfBufferResolver` via `pathWithinDataSource` | **Applies to every reality model:** relative glTF buffers in ion and ContextShare tiles now load through the data source instead of failing. Splat tilesets use geometric error even if the source does not. Validation runs only for splat tilesets with the option on. |
| `RealityDataSourceCesiumIonAssetImpl.ts` | Absolute URLs used as they are; token sent only to the endpoint's origin; `getTileContentType` ignores query, fragment and letter case | **Applies to every Cesium ion reality model:** relative tile paths are appended to the base URL exactly as before; absolute URLs on other origins no longer receive the ion token. |
| `render/RenderSystem.ts` | `Options.enableGaussianSplats`; `createGaussianSplatGeometry` returning `undefined` | None. |

**Look closely at.** The draft-profile heuristic in `readGaussianSplatSource`. `WorkerProxy`'s `onerror`, which tells a script that failed to load (a plain `Event`) from an error thrown while the worker runs (an `ErrorEvent`). The content range rule in `GltfReader`: a range the reader computes for native splats follows the graphic's outer transform; caller-supplied ranges keep the old convention. The token rule in `tileRequestHeaders`.

**Known limits.** No standalone PLY or SPZ files. No real-world tileset written to the draft extension text has been tested. Draft-profile metadata can change upstream.

## 2. Tile selection

**What it does.** Splat tiles are ordinary `RealityTile`s. For tilesets that declare `KHR_gaussian_splatting` (with the option on), `RealityModelTileTree.refinesWhenChildrenReady` is true, and `RealityTile` refines as CesiumJS 1.146 does with `skipLevelOfDetail: false` (`selectRefiningWhenChildrenReady`). Every other reality model keeps `RealityTile`'s usual traversal.

**Key decisions.**

- *Match CesiumJS.* The goal is the same level of detail as CesiumJS for the same asset. For every reality model that selects by geometric error, with the option on or off, `RealityTile.computeScreenSpaceError` uses the Euclidean distance from the eye to the tile's 3D Tiles bounding volume (`RealityTileBoundingVolume`: oriented box, region or sphere; a flat box's missing axis is rebuilt perpendicular to the others, as in CesiumJS), with no near-plane shortcut. Pixel size grows linearly with that distance, as Cesium's `sseDenominator` gives it (`TileDrawArgs.computePixelSizeInMetersAtDistance`). With `refinesWhenChildrenReady`, a tile with replacement refinement waits until all children are ready, so the parent stays displayed, and every needed tile is kept in the tile cache through `TileDrawArgs.touchedTiles` (Cesium's `touchTile`). Content requests use the ordinary reality-tile priority: a port of Cesium's `updatePriority` measured no difference in cold load on Redmond (median Ready 8.95 s with it, 8.99 s without, 22 alternating runs each). With RealityTile's usual traversal, Redmond's overview selected 16 tiles and 461,664 splats where CesiumJS selects one tile and 103,522 splats. Outside splats, the distance change was compared with CesiumJS on one photogrammetry tileset only, Cesium ion asset 40866 made to select by geometric error: the same 29 tiles as CesiumJS 1.146 at a close view, where the previous measure selected 35. Google Photorealistic 3D Tiles, which also select by geometric error, were not measured; that needs a Google API key (see [Open items](#open-items)).
- *Two deliberate differences from CesiumJS.* An additive child is not drawn while its replacement-refined parent is still displayed, because blending splats twice brightens them. While a needed tile is missing, its loaded descendants stand in for it (`selectReadyDescendants`) instead of leaving a hole.
- *Coverage separate from pending requests.* `RealityTileCoverage` says whether ready content covers the visible region, regardless of queued detail requests, and whether the traversal still waits on content or children. It follows the graphics as explicit data: set on the draw args (`TileDrawArgs.realityTileCoverage`) after traversal, output into the scene with the graphics (`Scene.realityTileCoverage`), and read from the scene the target last accepted (`Target.realityTileCoverage`). Shadow and drape collectors therefore cannot change the coverage of the displayed field. A NotFound tile counts as settled, so the renderer never waits for a request that will not finish. Only a tree that refines once children are ready records coverage (`selectRefiningWhenChildrenReady` returns it), since only such a tree draws splats; the usual traversal is unchanged.
- *External tilesets fetched concurrently, for every reality model.* Sibling children are resolved with `Promise.all`. `ConcurrencyLimiter` allows six external tileset JSON requests per reality model. A slot covers only the fetch, never nested expansion, so nesting cannot deadlock. Concurrent reads of the same child share one expansion (`expandExternalTileset`), and the roots it expands are passed to the tile props through `FindChildResult`. Disposing the tree rejects queued requests. Redmond has many external tilesets; this cut cold load from about 10.5 s to about 8.5 s, and the cap brought peak requests in flight from 52 to 6 with no change in load time.
- *No shadows.* Splats are not drawn into the shadow map, so splat trees report `castsShadows` false.

**Shared code and effect on apps without splats.**

| File | Change | Effect with the option off |
| --- | --- | --- |
| `tile/RealityTile.ts` | Screen-space error from the declared bounding volume; `selectRefiningWhenChildrenReady` | **Applies to every reality model that selects by geometric error** (Google 3D Tiles, `usesGeometricError` sources, tilesets declaring a maximum screen-space error): see [Changes that reach every application](#changes-that-reach-every-application). Other reality models are unchanged, and the usual traversal is too. |
| `internal/tile/RealityTileBoundingVolume.ts` | Oriented box and sphere distances | Used only by geometric-error selection. |
| `tile/RealityTileTree.ts` | `refinesWhenChildrenReady` (false by default); `RealityTileCoverage` set on the draw args after traversal | Coverage is recorded only by trees that refine once children are ready, which exist only with the option on. |
| `tile/TileDrawArgs.ts` | `computePixelSizeInMetersAtDistance`; `drawGraphics` outputs `realityTileCoverage` into the scene | Nothing to output with the option off. |
| `render/Scene.ts`, `internal/render/webgl/Target.ts` | `realityTileCoverage` | An empty map per scene. |
| `internal/tile/RealityModelTileTree.ts`, `internal/tile/ConcurrencyLimiter.ts` | Concurrent child resolution and the limiter; shared expansions, of which a failed one is fetched again; dispose cancels queued requests; sphere bounds returned by `rangeFromBoundingVolume`; external tileset roots passed to tile props; `castsShadows` for splat trees | **Applies to every reality model:** sibling external tilesets now load concurrently (up to six per model) instead of one after another. |

**Look closely at.** `RealityTile.computeScreenSpaceError`, which every reality model selected by geometric error uses. `RealityTile.selectWhenChildrenReady` and `childrenCanReplace`: child preparation runs even while the parent waits, so every required descendant keeps loading. `nearestContentReady` for external tileset roots without content. The coverage hand-off from draw args to scene to target.

**Known limits.** Implicit tiling and multiple contents per tile are not supported (rejected in commit 1). Splat requests share the reality-tile request channel and priority with other reality models. Splat trees ignore the viewport's tile-size modifier, as every reality model does. Under memory pressure, splat trees coarsen through `TileAdmin`'s memory factor like every reality model selected by geometric error (section 3).

## 3. GPU residency and memory

**What it does.** `GaussianSplatGeometry` holds a tile's CPU splat data and puts it in a new render pass, `RenderPass.GaussianSplats`. `GaussianSplatAtlas` holds the GPU copies of the tiles viewports display, in texture arrays shared by all viewports and owned by `System`. Splat memory is governed by `TileAdmin` like all tile content: there is no splat budget and no splat memory controller. Nothing draws yet; commit 4 does.

**Key decisions.**

- *Splats are tile content.* A splat tile's content bytes are its CPU copy (a new internal `RenderMemory` category, Gaussian splats) and the atlas rows it occupies while resident (textures), counted by the tile cache from the time the tile loads. `gpuMemoryLimit` therefore bounds splats together with all other tile content; unused splat tiles are freed by `TileAdmin.freeMemory`, least recently used first, as all tiles are; and `TileAdmin`'s memory factor (below) coarsens splat trees. Each viewport's sort worker and the shared decoder are reported in memory statistics but are not tile content.
- *Rows are resident while viewports retain a tile.* A viewport uploads a candidate field's tiles before it sorts them (`GaussianSplatAtlas.makeResident`), and a tile's rows are freed as soon as no viewport retains it (`GaussianSplatGeometry.release`). Residency cannot follow tile disposal: glTF tile graphics are created from templates whose node branches do not own their entries, so disposing a tile leaves its geometry to garbage collection. An earlier attempt that uploaded rows at load grew the atlas to 712 MB in a 30-second orbit under a limit for that reason. Counting rows from load overstates the GPU memory of loaded tiles no viewport displays (ancestors kept for coarsening, children waiting for siblings); it is an upper bound, never an underestimate.
- *Coarsening is TileAdmin's, for every reality model that selects by geometric error.* When the tiles in use that it can coarsen exceed their share of the limit, `TileAdmin.memoryScreenSpaceErrorFactor` rises by 2% per frame, as CesiumJS's `memoryAdjustedScreenSpaceError`; it falls by 2% per frame once they take less than 80% of their share and no content is loading. Their share is what the limit leaves after the other tiles in use, but at least half of the limit: content no factor can shrink, such as iModel tiles, must not coarsen reality models without freeing anything (an earlier version raised the factor to its cap of 64 whenever iModel tiles alone exceeded the limit). `LRUTileList` keeps the bytes of tiles in use, and of the coarsenable ones, as running totals. A factor found over the limit right after detail was restored becomes a floor until a viewport's view, the tile users or the limit change, so a view whose finer level does not fit settles instead of reloading it. `RealityTile` applies the factor to tiles selected by geometric error only (Google 3D Tiles, `usesGeometricError` sources, tilesets declaring a maximum screen-space error, splat tilesets): that is the selection Cesium's heuristic was designed for, and reality models selected by size on screen (most iTwin reality data, map tiles) keep their behavior.
- *One atlas for all viewports.* RGBA32UI texture arrays (256×128 texels per layer, on `Texture2DArrayHandle`) hold base records and higher SH rows. Tiles own whole rows of 128 splats ("pages") and reuse rows freed by other tiles. When a tile does not fit, an array is rebuilt with its rows packed and 1.5× capacity, copied on the GPU (`copyTexSubImage3D`) rather than uploaded again; it is rebuilt smaller once less than half is in use. Rows are recorded only after their upload, so a failed upload leaves no tile pointing at what it wrote.
- *The only admission is the device's.* Array layers are limited by `Capabilities.maxArrayTextureLayers`, and auxiliary layers also by the float32 tile metadata that addresses them (512 layers). If a candidate's tiles do not fit, none is uploaded, the previous field stays displayed, and `TileAdmin.onTileContentAllocationFailed` frees unused tiles and raises the factor. There is no `getError` driver-failure path and no catch-all treating exceptions as out of memory; context loss follows the render system's policy.

**Shared code and effect on apps without splats.**

| File | Change | Effect with the option off |
| --- | --- | --- |
| `tile/TileAdmin.ts` | `memoryScreenSpaceErrorFactor`, `onTileContentAllocationFailed`; the factor is adjusted in `process` | **Applies to every application with a memory limit:** reality models selected by geometric error coarsen when the tiles in use exceed it. |
| `internal/tile/LRUTileList.ts` | Running totals of the bytes of tiles in use, and of those of reality tiles selected by geometric error | None beyond the above. |
| `tile/RealityTile.ts` | Tolerance multiplied by the memory factor for tiles selected by geometric error (`selectsByGeometricError`) | 1 within the limit. |
| `internal/render/webgl/Texture.ts`, `GL.ts`, `System.ts`, `webgl-compatibility/Capabilities.ts` | `Texture2DArrayHandle`; 2D array binding through System's texture unit cache, which now records each target's binding on a unit separately; `maxArrayTextureLayers`; System owns and disposes the atlas | The atlas is created only with the option on. **Applies to every application:** the cache recorded one texture per unit, so unbinding one target marked a unit empty while another target was still bound there (a 2D texture and a cube map could already meet this way), and a later unbind of that target was skipped. |
| `render/RenderMemory.ts`, `frontend-devtools/MemoryTracker.ts` | Internal Gaussian splats consumer and its label | An empty row in the memory tracker. |
| `internal/render/webgl/RenderFlags.ts` | `RenderPass.GaussianSplats`, pass `"gaussian-splats"` | One more (empty) render pass. |
| `internal/render/RenderGeometry.ts` | `renderGeometryType` gains `"gaussian-splats"` | None. |

**Look closely at.** `TileAdmin.adjustMemoryScreenSpaceErrorFactor` (the floor and the recovery share), `LRUTileList`'s in-use total (it follows `tileUserIds` transitions in `markUsed`, `clearUsed` and `drop`), and `GaussianSplatRenderer.stageCandidate`, where the candidate is retained before it is made resident so that a refused candidate's rows are released with it.

**Known limits.** Counting rows from load overstates GPU memory for loaded tiles no viewport displays. Content that cannot be coarsened (iModel tiles) is not compared with the limit, but it reduces what the coarsenable tiles may take, down to half of the limit; when it alone exceeds the limit, the total stays over it. Restoring detail waits for all tile content to finish loading. Mobile limits have not been tuned on hardware.

## 4. Sorting and drawing

**What it does.** The scene compositor creates a `GaussianSplatRenderer` per viewport once the splat pass has commands. Each frame it gathers the visible splat tiles from the native draw commands, makes them the candidate field once the atlas holds them all, requests a sort, displays the candidate once its order is ready, and draws the displayed field after opaque geometry and before translucency.

Ownership:

| Owner | Resources |
| --- | --- |
| Render system | The splat, color-field fill and composite techniques (dynamic techniques, registered on first use); the atlas |
| Atlas | Shared GPU rows of resident tiles |
| Renderer and field | Displayed and candidate occurrences, retained content, sorted order and its logical layout |
| Sort scheduler | The viewport's worker, registered positions, pending and ready sorts, restart delay after a failure |
| Draw pass | Instance buffer (a `BufferHandle` in a `BuffersContainer`); tile metadata, clip-plane and page-table textures (`Texture2DHandle`), grown by doubling and updated in place; the linear color field |

**Key decisions.**

- *One sorted field per viewport.* All visible splat tiles are sorted together, back to front, on the viewport's worker (`Sorting.ts`): keys are quantized to 32-bit codes over their range and ordered by two stable 16-bit counting passes; runs of equal codes whose keys are out of order are re-sorted by exact key. The order equals a stable sort by exact key; at 2 million splats it is about 30% faster than the WebAssembly kernel it replaces.
- *Logical slots, not atlas rows.* Each visible occurrence of a tile owns a contiguous range of logical pages. A per-frame page table (`GaussianSplatInstances`) maps each page to its atlas row and tile row. The atlas can move or compact tiles while a sort is in flight without invalidating it. Remapping sorted instances on the main thread was rejected; it cost about 1.7 s of main-thread time on a 32 s camera route. Occurrences the table cannot resolve are hidden and logged, at most once per ten seconds.
- *Skip needless sorts.* One sort runs at a time per viewport; only the latest request waits. A candidate is identified by its logical layout object, kept while its occurrences (geometry and world transform, compared directly) are unchanged; there are no per-frame JSON keys. A camera-distance order is kept while the eye moves less than the distance that turns the direction to the nearest splat by 0.25°, a view-depth order while the view turns less than 0.25°. The nearest splat's distance comes from the eye-space bounds of the tiles' means. A failed sort worker is replaced after a delay that doubles from 1 s up to 30 s; meanwhile the displayed field stays as it is.
- *No holes during refinement.* `GaussianSplatField` displays a candidate only once its own order is ready. While the displayed tiles' sources are still loading, a sorted subset never replaces a complete field. The field keeps the native draw commands of its tiles, without copies of their batches, so it can be drawn after native command generation has moved on. It is dropped on a schedule change only when the previous or current script animates one of its models.
- *Gathering without replay.* Tiles are derived from the draw commands directly: branch states with `BranchState.fromBranch`, appearances from the batch's feature through the branch's symbology overrides, and clip planes and range culling from `ClipStack` queries that evaluate pushed volumes without pushing them. Nothing is pushed onto the target, and no feature override tables are created for splat batches.
- *Color.* Splats trained in display space (`srgb_rec709_display`, nearly all content) blend premultiplied straight into the frame. A multisampled frame is resolved first and the splats are blended into its single-sample buffers: blending them per sample made a 4x multisampled frame five times as expensive. Linear-trained splats blend into a separate color field (half float where the render system's capabilities report float color buffers), filled from and composited back onto the frame with passes scissored to the splats' projected bounds; the field is released when no linear splats are drawn.
- *Shader.* Instanced quads, one per splat, projected as screen-space ellipses from the packed record. SH up to degree 3. Covariance widened by 0.3 px² and cut off at three sigma, as the extension asks; CesiumJS 1.146 widens less and cuts off at 2.83 sigma, so thin and distant splats look slightly wider and softer here. The three-sigma semi-axis is capped at 512 CSS pixels, as CesiumJS caps it, so near splats cover the same part of the view at any device pixel ratio. Clipping reuses the native clipping GLSL; uniform color/transparency overrides apply per tile, converted to the trained color space on the CPU.
- *The render system's abstractions.* The draw resources are a `BuffersContainer` and `BufferHandle` for the instances, `Texture2DHandle`s for the per-frame rows, and the atlas's `Texture2DArrayHandle`s, all bound through `System`'s texture unit cache. Each gains only what splats need: `BufferParameters.glInteger` for the integer instance attribute (`vertexAttribIPointer`), unsigned integer RGBA data in `Texture2DHandle`, and `Texture2DHandle.replaceTextureData` of only a texture's first rows. Alternating three runs each before and after the change, the Redmond detail pose took GPU p50 11.04–11.20 ms before and 10.96–11.31 ms after.
- *Techniques.* The splat, fill and composite programs are dynamic techniques of the render system, compiled, bound and disposed like every other technique; the fill and composite are built with `ProgramBuilder` on the viewport quad. The splat program keeps whole hand-written sources (`glsl/GaussianSplats.ts` explains why). Its fragment shader discards splats of the other trained color space: culling them in the vertex shader instead measured about 7% more GPU time on the Redmond detail pose (12.1 instead of 11.3 ms), although no splat there was culled.
- *Robustness.* `FrameBufferStack.execute` pops its framebuffer in a `finally`, and the splat pass compiles its programs before it binds a framebuffer, so a failing pass cannot leave the rest of the frame drawing into its framebuffer. Command gathering restores no target state because it pushes none. A failure in the splat pass is logged; the rest of the frame still renders.
- *No depth.* Splats write no depth, so translucent BIM behind them is drawn over them, and the ambient occlusion of BIM behind them darkens them. The user documentation shows both. See [Why splats write no depth](#why-splats-write-no-depth).

**Shared code and effect on apps without splats.**

| File | Change | Effect with the option off |
| --- | --- | --- |
| `internal/render/webgl/SceneCompositor.ts` | `renderGaussianSplats` after the opaque pass; statistics; dispose; the renderer comes from the loaded splat module | Returns at once: no splat commands and no renderer. |
| `internal/render/webgl/System.ts` | Starts loading the splat module when created with the option; splat techniques registered on first use or by `compileAllShaders`; the atlas | The module is never loaded, and nothing is created, with the option off. |
| `internal/render/webgl/Technique.ts` | `getDynamicTechniqueId` returned a wrong ID for every dynamic technique after the first | Only the splat techniques look IDs up in production code. |
| `internal/render/webgl/FrameBuffer.ts` | `FrameBufferStack.execute` pops in a `finally` | **Applies to every pass:** one that throws no longer leaves its framebuffer bound. |
| `internal/render/webgl/ClipStack.ts`, `glsl/Clipping.ts` | `planeCountWith`, `writePlanesWith`, `isRangeClippedWith`, which all skip an empty view clip as the stack does; clipping GLSL exported | Not called. |
| `internal/render/webgl/AttributeBuffers.ts`, `Texture.ts` | `BufferParameters.glInteger`; unsigned integer RGBA data and partial row replacement in `Texture2DHandle` | Native geometry uses neither. |

**Look closely at.** `GaussianSplatRenderer.prepare` and its steps. Resource ownership and cleanup across the owners above, and `sleep` when a viewport's splat models are removed. Shader projection in `glsl/GaussianSplats.ts`. The blend states in `GaussianSplatDrawPass.drawColor`. `gatherGaussianSplatTiles`, which must find the same branch, batch and clip state the native passes apply.

**Known limits.** Splats are not multisampled; with MSAA they are tested against the resolved depth, so edges against BIM are not antialiased. Splats write no depth (see below). Fields trained in different color spaces are drawn one space after the other, not interleaved. No crossfade between levels of detail. Clipping is tested on a camera-facing plane through each splat's mean, so it is approximate. Planar clip masks, classification, thematic display and selection highlighting do not apply to splats. Ellipse projection runs per vertex. An image rendered in a single frame, such as an off-screen viewport's `readImageBuffer` or a thumbnail, shows no splats, because their order arrives from the worker a frame or more later; the user documentation says so.

### Why splats write no depth

Without depth, translucent BIM behind a scan is drawn over it, and ambient occlusion computed from BIM behind it darkens it. A prototype drew the splats a second time, writing the depth of their means where a fragment was at least half opaque, and no occlusion there. It was compared with this branch on a scan with a translucent slab beneath its ground and opaque BIM boxes standing on the slab. It was not kept, for two reasons:

- *Cost.* As a second pass it took the Redmond detail pose from 11.3 to 37.1 ms of GPU time per frame (headless Chromium, ANGLE on Metal, Apple M4 Pro, quiet GPU).
- *Look.* An opacity threshold turns soft, thin splats into a hard, blotchy surface: where the splats are thin, such as road surfaces, the slab showed through in irregular blotches.

Writing depth in the color pass would remove the cost, but not the blotches. A follow-up could write a soft coverage mask instead, which translucent geometry and ambient occlusion would weight by.

## 5. Display Test App and documentation

`IMJS_ENABLE_GAUSSIAN_SPLATS` turns the option on in Display Test App. The key-in `dta gaussian ion <assetId>` (with `IMJS_CESIUM_ION_KEY`) opens a blank connection at the asset, attaches it as a reality model, and frames its root bounding volume on a dark background without sky or ground. `Surface.openBlankConnection` becomes public for the tool.

`docs/learning/display/GaussianSplats.md` is the user-facing contract: supported content (including that only declared tilesets draw splats), rendering limits (including one-frame renders), the limitations of drawing no depth (with screenshots), picking scope, deployment and memory behavior. Applications that enable the option must deploy `scripts/gaussian-splats-worker.js`, allow the worker in their Content Security Policy (it needs no WebAssembly), and retain the package's third-party notices. The changes that reach every application are described in the commits that make them and listed below.

## Shared code and public API

The public API gains only optional, `@beta` or `@internal` members: `RenderSystem.Options.enableGaussianSplats` (`@alpha`), `GltfReaderArgs.resolveBuffer` and `drawsGaussianSplats`, the protected `RealityTileLoader.gltfBufferResolver` and its `rendersGaussianSplats`, an optional `sphere` in `RealityModelTileUtils.rangeFromBoundingVolume`'s result, `WorkerProxyOptions` and `createWorkerProxy`'s optional `options` (`@beta`), the `"gaussian-splats"` geometry type and memory consumer, and `@internal` members of `RenderSystem`, `RealityTile`, `RealityTileTree`, `TileAdmin`, `TileDrawArgs`, `Scene` and `Capabilities`.

## Changes that reach every application

These apply with the option off. None changes an API's signature, but each changes behavior:

| Change | Commit | Effect |
| --- | --- | --- |
| Screen-space error measured to the declared bounding volume (`RealityTile.computeScreenSpaceError`) | 2 | Reality models selected by geometric error (Google Photorealistic 3D Tiles, `usesGeometricError` sources, tilesets declaring a maximum screen-space error) can load fewer, coarser tiles near the camera. Compared with CesiumJS on one photogrammetry tileset (Cesium ion asset 40866): the same 29 tiles at a close view, where the previous measure selected 35. Google Photorealistic 3D Tiles were not measured. |
| Memory-adjusted screen-space error (`TileAdmin.memoryScreenSpaceErrorFactor`) | 3 | With a memory limit, the same reality models coarsen while the tiles in use exceed their share of it, instead of exceeding the limit. |
| `WorkerProxy` failure handling | 1 | A worker whose script fails to load is terminated and its pending calls reject; they never settled before. Calls after termination reject; terminating again does nothing. An error a running worker throws outside an operation is still reported as uncaught and leaves the worker running, so the iModel tile parser's shared worker keeps working. Documented in WorkerProxy.md. |
| Concurrent fetching of external tilesets (`ConcurrencyLimiter`) | 2 | Sibling external tilesets of a reality model load up to six at a time instead of one after another; concurrent reads share one request, a failed one is fetched again when next needed, and disposing the tree drops queued requests. |
| Cesium ion data source URLs and token | 1 | Absolute URLs in content are requested as they are; the ion token goes only to the asset endpoint's origin; a path ending in `json` before a query or fragment, in any case, is a tileset. Relative paths are resolved as before. |
| Reality glTF tiles (`RealityTileLoader`, `GltfReader`) | 1 | Relative external buffers load through the reality data source where they failed before; content that fails to load is logged as a warning (`RealityData`, at most once per ten seconds, without the query string) where it was silent; a canceled tile stops reading. |
| `FrameBufferStack.execute` pops in a `finally` | 4 | A pass that throws no longer leaves its framebuffer bound for the rest of the frame. |
| `System`'s texture unit cache records each target separately | 3 | Unbinding one target of a unit no longer hides another target still bound there. |
| `Techniques.getDynamicTechniqueId` returns the right ID | 4 | It returned a wrong ID for every dynamic technique after the first; only the splat techniques look IDs up in production code. |

## Dependencies and licenses

The branch adds no dependencies; the lockfile is master's. The SPZ decoder follows Niantic's MIT-licensed reference implementation, so `core/frontend/ThirdPartyNotices.md` reproduces its license.

## How it was verified

**Automated tests.** From `core/frontend`, `rushx test` runs Vitest in Playwright Chromium, including pixel assertions on real WebGL output. With this branch: 147 test files, 1,219 tests passed. The tests are deliberately few until the design is reviewed; each proves one essential. The branch adds or extends these test files (15 tests):

| File | Tests | Covers |
| --- | --- | --- |
| `test/render/GaussianSplatData.test.ts` | 3 | An independent SPZ golden payload; glTF of both supported profiles (the ratified extension's attributes, Cesium ion's draft SPZ content); malformed SPZ rejected |
| `test/render/GaussianSplatSort.test.ts` | 1 | Every occurrence ordered back to front exactly once across pages and repeated tiles |
| `test/render/webgl/GaussianSplats.test.ts` | 4 | An ellipse drawn in orthographic and perspective views; SH bands 1–3 against the 3DGS reference; hidden by opaque BIM in front; a complete LOD field kept until its replacement's sort is ready |
| `test/tile/RealityTileSelection.test.ts` | 3 | Screen-space error measured to the bounding volume; refinement only once all children are ready; a tile whose content was not found counts as covered |
| `test/tile/TileMemoryCoarsening.test.ts` | 2 | Coarsening over the limit, then settling; content that cannot be coarsened does not coarsen reality tiles |
| `test/worker/WorkerProxy.test.ts` | 2 (of 7) | An error thrown outside an operation leaves the worker running; a script that fails to load rejects pending calls |

`test/render/GaussianSplatFixtures.ts` generates the splat data and glTF the tests read, and `test/tile/ScriptedRealityTiles.ts` scripts reality tiles for selection and memory.

Every commit passes `rushx build` and `rushx lint` in `core/frontend` (lint reports only the existing BingElevation warning; commit 3 also builds and lints `webgl-compatibility` and `frontend-devtools`) and the tests in the files it adds or changes; tests arrive with the code they test. The tip also passes `rush build -t display-test-app`.

**Comparison with CesiumJS.** The same ion assets were loaded in CesiumJS 1.146 and in this renderer at matched camera poses. Selected tiles, splat counts and per-tile screen-space error were compared, with Cesium's dynamic and foveated screen-space error off and at its defaults. Pacing was measured as requestAnimationFrame intervals along fixed camera routes. These results come from the first version of this work; the final code selects the same tiles (see [Against the earlier version](#against-the-earlier-version)):

| Measurement | CesiumJS 1.146 | This branch |
| --- | --- | --- |
| Redmond overview | 1 tile, 103,522 splats | Same |
| Redmond detail | 65 tiles, 1,845,251 splats | Same tiles; screen-space error ratio 1.000 at p10/p50/p90 |
| Boathouse, four poses | 4 tiles, 549,741 splats | Same |
| Sandcastle, four poses | 4 tiles, 403,364 splats | Same |
| Redmond memory at full detail (1440×900 view) | — | 242 MB of tile content (CPU copies and atlas rows) |
| Pacing, Boathouse orbit and Redmond route | rAF p95 16.7–16.8 ms; two long tasks (139–146 ms) per Redmond run | rAF p95 16.7–16.8 ms; no long tasks |

**Memory limit on a non-splat reality model.** A public Cesium ion photogrammetry tileset made to select by geometric error, at 27.7 MB, 60% of its close view's 46 MB: previously it kept all 29 tiles at 46 MB; now it settles in 1.5 s on 16 tiles at 26 MB, after reloading 5 ancestors the cache had freed first.

**Manual checks in Display Test App.** With `IMJS_ENABLE_GAUSSIAN_SPLATS=1` and `IMJS_CESIUM_ION_KEY` set: `dta gaussian ion 4547222` (Redmond), `3667783` (Boathouse) and `3667784` (Sandcastle). Leave the FPS display off when judging smoothness; it forces continuous redraw. Earlier live checks, before the reorganization, also covered budget recovery (at 64 MiB Redmond's detail pose settled on one tile; raising the budget to 512 MiB restored all 65 tiles within 30 seconds) and two viewports on one tileset (closing one released its renderer without losing the other's detail). After picking was removed, Redmond was loaded again and rendered without browser errors.

### Against the earlier version

An earlier version of this work had its own tile class instead of `RealityTile`'s traversal, a splat memory controller instead of `TileAdmin`'s memory factor, WebAssembly SPZ decoding and sorting, and splat programs outside the render system's techniques. The final code was measured against it, alternating: headless Chromium (ANGLE on Metal), Apple M4 Pro, 1440×900 at device pixel ratio 2. Another application kept the GPU about 80% busy during these runs, except the static GPU row, which was measured on a quiet GPU; frame pacing under that load is a comparison of the two versions only.

| Measurement | Earlier version | This branch |
| --- | --- | --- |
| Selection: Redmond overview / detail, CesiumJS with and without its dynamic and foveated SSE | 1 / 103,522; 65 / 1,845,251; same tiles as CesiumJS | Same tiles |
| Selection: Boathouse, Sandcastle, four poses each | 4 / 549,741; 4 / 403,364 | Same tiles |
| Camera route (3 runs): rAF p50/p95/p99, frames over 20 ms | 16.7/16.8/33.4 ms; 60–65 | 16.7/16.8/33.3–33.4 ms; 55–62 |
| Long tasks per route | 6–7 (up to 73 ms) | 0 |
| Render CPU p95 | 3.8–3.9 ms | 3.5–3.6 ms |
| Sorts requested / orders displayed per route | 122–126 / 58–64 | 140–143 / 59–65 |
| 4x MSAA route (3 runs): rAF p95, frames over 20 ms, long tasks | 16.8 ms, 77–85, 6–7 | 16.8 ms, 63–70, 0 |
| Static detail pose GPU p50, quiet GPU (240 redraws, 3 alternating rounds) | 11.4 ms | 11.3 ms; 12.1 ms with the color-space test in the vertex shader |
| Orbit 30 s + hold 20 s at 0.6× (3 runs) | Held 29–36 tiles, 0.82–1.01 M splats; 10–20 reloads while holding; fewest tiles while moving 1; settled 42–49 s | Held 36 tiles, 1.02 M splats; no reloads while holding; fewest tiles while moving 12–17; settled when the orbit ended |
| Orbit + hold at 1.5× (2 runs) | Full detail; 19–20 long tasks (up to 82 ms) | Full detail; no long tasks |
| Static limit lowered to 0.6× (2 runs) | 29–30 tiles, settled in 2.5–9 s | 36 tiles, settled in 1–1.5 s |
| Two viewports at 1.3× one view, then one closed (2 runs) | 1.02 M + 1.43 M splats; full detail 2.5–3 s after closing | 1.18 M + 1.79 M splats; full detail 3 s after closing |
| Content no factor can shrink (3× the splats' bytes) in use, limit 2.5× | Full detail, factor 1 | Full detail, factor 1 (before the fix in section 3: 1 tile, factor 64) |
| The same, limit 1.2× | 36 tiles, factor 1.46 | 36 tiles, factor 1.46 (before the fix: 1 tile, factor 64) |
| Cold load of the detail pose, Ready (two sets of 6 runs) | Median 7.34 s; 7.25 s | Median 7.24 s; 7.53 s (Ready follows when the last tile content arrived) |
| Atlas arrays allocated during that load | 6–12 (94–180 MB) | 8–9 (100 MB); 15 GPU row copies |
| Screenshots: Redmond detail and overview, Boathouse close and oblique | — | Splat pixels differ by 0.9–1.1 levels on average; 0.04–0.9% by more than 8 levels, on thin bright features; background identical within 1–2 levels |
| Main bundle, option off (minified, an app that starts `IModelApp`) | 72.7 KB of splat modules | 0.2 KB, with the rest loaded on demand (see below) |

Two regressions were found and fixed during this comparison. The splat draw took about 7% more GPU time after the move to techniques; it was bisected to the vertex shader culling other color spaces, and the test is back in the fragment shader. The memory factor rose to its cap whenever content it cannot shrink exceeded the limit; it now compares only the coarsenable tiles with their share of the limit.

A harness in Display Test App reruns these measurements; it is kept out of this proposal, on the local branch `bdp/splats-harness`, one commit on top of this branch.

### Loading on demand

The splat implementation loads through one dynamic `import()` of `internal/render/webgl/GaussianSplatModule.ts`, which re-exports what the rest of the frontend uses: the decoder client (commit 1), atlas and geometry (commit 3), techniques and renderer (commit 4). Outside it, the frontend imports only types from splat modules, plus two small modules: `GaussianSplatModuleLoader.ts` (`loadGaussianSplatModule`, `loadedGaussianSplatModule`) and `GaussianSplatError.ts`, so that the reader can reject unsupported content without loading the implementation. `RenderPass.GaussianSplats`, the memory consumer and the `"gaussian-splats"` geometry type stay where they are: they are enum members and a string type.

- `System` starts the import when it is created with the option, so that the module usually arrives before the first splat tile.
- `GltfReader` awaits the module before it decodes a splat primitive; tile reading is already asynchronous. With the option off it finds no splat primitives and never asks for it.
- Only the module creates splat geometry, so draw commands for splats, and with them the renderer and the atlas, exist only once it has loaded. `SceneCompositor` and `System.gaussianSplatAtlas` rely on that (`expectDefined`); nothing draws, and nothing needs a redraw, before the module arrives. `compileAllShaders` and memory statistics skip the module until it has loaded.

Measured with an app that starts `IModelApp` (esbuild, minified, code splitting on): the eager bundle held 52.2 KB of splat modules before and holds 0.2 KB now (the loader and the error helper); the eager bundle shrinks by 46.7 KB, the rest being cross-chunk import glue; the splat chunk was 52.6 KB, 51.3 KB once the depth prototype was removed, and is 50.6 KB in the final code. Display Test App's Vite build emits `GaussianSplatModule-*.js` (100 KB unminified, 28 KB gzipped); its main chunk keeps no shader source or splat classes, only the loader and the routing above. At the Redmond detail pose (device pixel ratio 2, 12 alternating cold loads each): 65 tiles and 1,845,251 splats; screenshots identical to the pixel; Ready median 7.28 s before and 7.27 s after (ranges 7.01–7.80 s and 7.01–8.53 s); first splats drawn at a median 1.26 s before and 1.28 s after; no frame without splats after the first frame with them, before or after.

## Open items

- Measure the screen-space error change on Google Photorealistic 3D Tiles against CesiumJS. It was compared only on one photogrammetry tileset (Cesium ion asset 40866); Google's tiles need a Google API key.
- Test a real tileset written to the draft extension text and a real iTwin reality-data capture.
- Test on more hardware, including mobile, and tune mobile limits.
- Splat picking, once a use case defines its semantics.
- A soft coverage mask, so that translucent BIM and ambient occlusion respect splats (see [Why splats write no depth](#why-splats-write-no-depth)); LOD crossfade; moving large atlas appends off the main thread.
- Measure GPU time on hardware other than Apple silicon; the cause of the color-space shader cost is not understood.
