# Gaussian splats preview

The native iTwin.js WebGL2 renderer can display Gaussian splat reality models. Enable the alpha preview at application startup:

```ts
await IModelApp.startup({
  renderSys: { enableGaussianSplats: true },
});
```

Attach a compatible 3D Tiles tileset through the existing reality-model API:

```ts
viewport.displayStyle.attachRealityModel({
  tilesetUrl: "https://example.com/splats/tileset.json",
  name: "Gaussian capture",
});
viewport.invalidateScene();
```

For Cesium ion assets, use the application's existing [CesiumAccessClient]($frontend) or `TileAdmin.Props.cesiumIonKey` configuration and reality-data source key. External glTF buffers use the same reality-data transport as their tiles. The renderer does not depend on Cesium's rendering engine.

In Display Test App, set `IMJS_ENABLE_GAUSSIAN_SPLATS=1` and attach the reality model using the existing reality-model tools. The preview defaults to disabled; ordinary geometry rendering is unchanged.

## Supported content

| Content | Preview support |
| --- | --- |
| Explicit 3D Tiles with one GLB/glTF per tile | Supported, including nested external tilesets |
| `KHR_gaussian_splatting` | Ellipse kernel, linear scales, normalized opacity, xyzw rotation, complete SH degrees 0–3 |
| Trained color spaces | `srgb_rec709_display` and `lin_rec709_display`; compose before transfer-function conversion |
| Nested `KHR_gaussian_splatting_compression_spz_2` | SPZ v2 with the current base metadata; decoded to glTF LUF |
| Established Cesium/ion draft profile | COLOR_0 placeholders with no kernel/colorSpace or degree-zero SH; preserve Cesium's stored coordinates and accept SPZ v2/v3 |
| Views | Perspective and orthographic 3D |
| Scene integration | View/branch clip volumes, opaque BIM depth, MSAA, approximate model picking, uniform color/transparency overrides |

The original `KHR_spz_gaussian_splats_compression` extension is unsupported. Retile that content with the current Cesium ion pipeline. Implicit tiling, multiple tile contents, standalone PLY/SPZ files, reconstruction, upload, export, and tiling are outside this preview.

The established Cesium profile follows the behavior verified in CesiumJS 1.146 and its official compressed test fixture. Because the compression extension is a draft, its metadata and payload conventions can change. Content with current base metadata uses the Khronos LUF convention. See the [implementation plan](./GaussianSplatsPlan.md) for the evidence and version-specific decisions.

Composition includes the opaque scene background in the trained space. Reconstructed SH colors retain values above one until blending completes; negative values and the completed image are clamped as specified by the base extension. The renderer uses a floating-point field when the device supports float attachments and blending; its premultiplied normalized-buffer fallback is lossy.

## Picking and visual limits

Model picking selects the nearest camera-facing plane through a splat's mean whose effective Gaussian alpha is at least 0.1. This is an approximation of the visible field. Splats supply no snapping, measurement, section-cut, or surface geometry.

Splats blend in a globally sorted viewport pass after opaque geometry. Interleaving with translucent BIM, interleaving fields trained in different color spaces, volume/planar classification, thematic display, and selection highlighting are not implemented. Ordinary translucency renders after the Gaussian field. During refinement or native tile eviction, a completed source remains visible and pickable with the current camera and clipping until its replacement has ready native coverage and a completed global sort. A ready fallback parent counts as coverage; speculative requests and unrelated BIM/map loading do not block the handoff. The renderer then switches the whole selection together. Initial content awaits its first sort and can build progressively until its first complete selection. The transition does not crossfade changes in capture detail. Removing a native source hides its retained splats immediately.

## Deployment and memory

Deploy the frontend package's public assets with the application, including `scripts/gaussian-splats-worker.js`, using the same [IModelApp.publicPath]($frontend) configuration as other frontend workers. SPZ decoding runs in a browser worker with embedded WebAssembly. The deployment's Content Security Policy must allow that worker and WebAssembly compilation; a public path on another origin also requires the existing blob/importScripts worker pattern and appropriate CORS headers.

Decoded CPU data uses 240 bytes per splat. GPU storage uses the same layout in pages of 16,384 splats shared across viewports; atlas capacity grows geometrically and shrinks after a substantial reduction in selected detail. Atlas replacement temporarily uses memory for both textures so allocation failure preserves working splats. A viewport can also retain one completed selection alongside its latest candidate, including CPU data, worker positions, and GPU pages, until the candidate is sorted. An active source retains its completed field through temporary gaps in native ready content. Each viewport adds its own sorted instance list and sort scratch memory. Four million visible splats therefore need substantial system and GPU memory even at SH degree zero. GPU layer or allocation limits produce a renderer diagnostic; reduce selected tile detail if the device cannot accommodate the field. Tile statistics include CPU data and GPU page allocations. The existing [TileAdmin.gpuMemoryLimit]($frontend) applies to cached tile content; completed data retained after tile eviction is accounted for separately and is not an automatic active-splat budget.

The preview selects declared Gaussian tilesets using geometric error and applies [Viewport.tileSizeModifier]($frontend) to their screen-space error threshold. It does not adapt Gaussian detail automatically to an active-splat budget. A large capture at a high device pixel ratio can exceed atlas capacity. Failed replacement staging preserves the last working Gaussian field and reports a diagnostic; without a completed field, the opaque scene remains visible. Increase the tile-size modifier to select coarser tiles. In DTA, `fdt tilesize viewport 8` changes the selected viewport, and `IMJS_DEVICE_PIXEL_RATIO_OVERRIDE=1` bounds its framebuffer resolution for a local demonstration. Choose these settings for the capture and device; they trade detail for lower memory and draw cost.

## Reproducible benchmark

From `core/frontend`, run:

```sh
ITWIN_GAUSSIAN_BENCHMARK=1 rushx test GaussianSplatsBenchmark.test.ts --reporter=verbose
```

The opt-in fixture draws one million and four million splats, measures worker sort latency, time to the first visible sorted frame including upload/readiness, and five completed frames using `gl.finish()`, and prints the actual viewport, GPU renderer, browser version, SH degree, and memory allocation. It is a synthetic baseline, not a prediction for a capture with large overlapping ellipses. Routine test runs skip these large allocations. Verification results are recorded in the [plan](./GaussianSplatsPlan.md).

To capture the official Cesium compressed fixture in a native iTwin viewport, run `ITWIN_GAUSSIAN_SCREENSHOT=1 rushx test GaussianSplatsCapture.test.mts`. The test saves `lib/gaussian-splats-cesium.png`.

For a recognizable scene, add `ITWIN_GAUSSIAN_SCREENSHOT_URL=https://raw.githubusercontent.com/CesiumGS/cesium/1.146/Specs/Data/Cesium3DTiles/GaussianSplats/tower/0/0.glb` to that command. This downloads Cesium's public tower fixture (286,868 splats) without ion credentials. The opt-in capture uses ANGLE Metal on macOS, checks that the framebuffer varies spatially, and fits the camera with an explicit lens angle.

To exercise the complete live ion reality-model pipeline, add `ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET=4547222` instead. This explicit opt-in uses CesiumJS 1.146's bundled public evaluation token in memory, attaches the tileset through the native reality-model API, waits for selected tile content, and captures the iTwin framebuffer. Public evaluation access is intended for validation; configure the application's own access client for deployment.

Add `ITWIN_GAUSSIAN_SCREENSHOT_COMPARE=1` for a reference capture using CesiumJS 1.146 at the same ECEF camera position and lens angle. This loads the SDK only in the opt-in test, saves `lib/gaussian-splats-reference.png`, and reports foreground overlap and color RMS difference. The broad regression thresholds detect gross placement or color errors; differing LOD selection and antialiasing mean they do not establish pixel-exact parity.

## Continuous zoom regression workflow

From `core/frontend`, run the offline native transition suite:

```sh
rushx test GaussianSplatsValidation.test.mts
ITWIN_GAUSSIAN_VALIDATION=1 rushx test GaussianSplatsValidation.test.mts
```

The second command also saves `lib/gaussian-validation-*.json` and standalone HTML contact sheets. The generated explicit tilesets use contrasting near/far splats, SHA-256 content identities, fixed camera routes, and seeded delivery/sort delays. Every known-visible frame is checked for the expected blended pixels; the two REPLACE zoom routes also check native model picking on every frame. Content-root and structural-root eviction routes retain both world patches and native picks while only one reloaded child is sorted, then verify full replacement. Further fixtures verify progressive initial loading, complete child fallback for a missing parent, and camera-only sorting while another region loads. Distinct ADD parent/child patches remain visible when either required content is evicted. The suite must observe completed native refinement with complete source coverage and return the shared atlas to zero pages after disposal. Positive controls suppress a native draw, supply source-order blending, retire the working field early, and allow a sorted partial subset to replace full coverage. Negative controls exercise hiding, clipping, camera movement, and selected children whose sort never completes. Further tests preserve late failure windows and verify that browser timing uses the next native render without GPU readbacks. The ordinary renderer suite separately exercises actual worker sorting, stale content, native eviction, shared atlas compaction, allocation failure, and schedule rebuilds versus actual scheduled omissions.

In DTA, load the real iModel and reality model, use the existing Models/Diagnostics/Inspect Element controls, and enter:

```text
dta gaussian trace visual /private/tmp/gaussian-visual warm
dta gaussian trace stop
dta gaussian trace timing /private/tmp/gaussian-timing warm
dta gaussian trace stop
```

Navigate between start and stop. Use an existing output directory on your platform; omitting the prefix writes timestamped artifacts under DTA's `lib`. Each stop saves JSON and HTML through DTA's existing local file transport. Visual mode reads reduced-size framebuffer evidence after each native draw and keeps bounded before/during/after failure windows. Timing mode performs no image readbacks and records browser animation intervals, input-to-next-native-render samples, pending inputs, and long tasks. Both record native camera poses, actual GL submissions, selected/completed generations, source coverage/readiness waits, in-flight/candidate ages, atlas capacity, leased packed arrays, actual framebuffer/DPR, tile memory policy, and map/terrain/depth settings. Cache labels are supplied by the caller; live asset content hashes remain unknown. Recording automatically saves after 60 seconds; a failed file write preserves the stopped trace for another stop attempt.

To repeat camera poses, start either recorder and enter `dta gaussian trace replay /private/tmp/gaussian-visual.json`. Playback uses the recorded timestamps without waiting for loading or sorting and records the poses actually executed. Keep the source, viewport size, clipping, tile-size modifier, and map/terrain settings matched when comparing runs. This is a programmatic pose route; use actual wheel/pointer actions for input latency. Existing DTA Camera Paths also remain available for saved navigation routes.

Treat the gates separately. Known visible-region pixel assertions establish offline continuity. Settled Gaussian-source selections at different depths with different completed generations establish observed refinement; pending tile selection alone does not. A live trace without trusted pixel probes reports visual continuity as unverified, even when every draw submits splats. Responsiveness requires a baseline on the recorded hardware; native submission and browser animation callbacks do not measure display presentation latency. Reduced-size captures and the synthetic patches cannot guarantee that a real capture has no local LOD seams, so inspect the live contact sheet and add settled reference patches when investigating a new artifact.
