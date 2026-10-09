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

In Display Test App, set `IMJS_ENABLE_GAUSSIAN_SPLATS=1` and attach the reality model using the existing reality-model tools. For a Cesium ion asset, also set `IMJS_CESIUM_ION_KEY` and key in `dta gaussian ion <assetId>` (for example `dta gaussian ion 4547222` for the Redmond campus). It opens a blank connection centered on the asset, attaches it and aims the view at it; the default blank connection is located elsewhere, so an ion asset attached to it is out of view. Set `IMJS_ASYNC_HOVER_READBACK=1`, or key in `dta async hover [on|off]`, to compare the asynchronous hover-locate readback described below. The preview defaults to disabled; ordinary geometry rendering is unchanged.

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

While the cursor is moving, splats are left out of the pick buffer. Hover locate reads the pick buffer on every mouse motion event, and each read waits for the GPU to finish the queued frames plus a full splat pick render, which was the largest source of stutter during navigation over a splat field. The tool re-evaluates at the resting cursor position 100 ms after motion stops, and that pick includes splats, so hover flashing and tooltips over splats appear once the cursor rests. Depth picks issued while the mouse is moving, such as wheel zoom about the cursor, see only BIM geometry and fall back to the view's default target over a splat-only scene. This is a first-pass mitigation. The complete fix is asynchronous pick readback, prototyped behind the internal `AccuSnap.asyncHoverReadback` flag: hover locate then renders the pick buffers as before but copies them into pixel pack buffers behind a GPU fence and resolves the hits once the fence signals, so mouse motion never waits for the GPU. See the plan document for measurements.

Splats blend in a globally sorted viewport pass after opaque geometry. Interleaving with translucent BIM, interleaving fields trained in different color spaces, volume/planar classification, thematic display, and selection highlighting are not implemented. Ordinary translucency renders after the Gaussian field. During refinement or native tile eviction, a completed source remains visible and pickable with the current camera and clipping until its replacement has ready native coverage and a completed global sort. A ready fallback parent counts as coverage; speculative requests and unrelated BIM/map loading do not block the handoff. The renderer then switches the whole selection together. Initial content awaits its first sort and can build progressively until its first complete selection. The transition does not crossfade changes in capture detail. Removing a native source hides its retained splats immediately.

## Deployment and memory

Deploy the frontend package's public assets with the application, including `scripts/gaussian-splats-worker.js`, using the same [IModelApp.publicPath]($frontend) configuration as other frontend workers. SPZ decoding runs in a browser worker with embedded WebAssembly. The deployment's Content Security Policy must allow that worker and WebAssembly compilation; a public path on another origin also requires the existing blob/importScripts worker pattern and appropriate CORS headers.

Decoded base storage uses 32 bytes per splat: float tile-relative means, normalized half covariance, and byte color/opacity. SH storage uses only the declared degree, retaining float DC and higher coefficients for nonzero degrees. Exact float appearance is retained where byte encoding changes shader values; anisotropic covariance uses a float precision supplement. Tiny and large isotropic splats use a power-of-two covariance normalization. These supplements preserve supported color/opacity and precision semantics, so 32 bytes is the minimum rather than a universal total. GPU pages are shared across viewports and allocated to exact capacity. Tile statistics include all packed CPU arrays and the corresponding GPU storage.

The shared atlas holds persistent base and auxiliary texture arrays with spare capacity, and checks a 256 MiB GPU residency budget before admission. Each tile owns contiguous page and row ranges, so a selection change uploads only its new tiles; the arrays are rebuilt only to grow or to compact once under half the capacity is in use. A rebuild allocates its replacement beside the current arrays when both fit the budget, and otherwise rebuilds in place from the retained CPU copies. Candidates sort before GPU admission. Admission also estimates packed CPU arrays, worker positions and page staging against 512 MiB; registered positions, per-viewport sort scratch reservations, and retained decoder/sorter heaps are included. WASM heap usage is also reported in frame diagnostics. The worker rejects individual tiles above 2,097,152 splats, or whose estimated packing workload exceeds 512 MiB, before packing/codec allocation. Previously larger tiles could proceed until an uncontrolled allocation failure; producers must split those tiles. Decodes run serially, with queued input buffers and the active packing peak charged separately; temporary queue pressure does not fail valid tiles. Idle SPZ decoders and packing heaps above 64 MiB are retired after settling their requests. These are bounded workload policies, not a measurement of the device's free VRAM.

When admission cannot fit a Gaussian selection, the renderer preserves its completed field and asks native traversal for coarser tiles of the affected Gaussian trees. Feedback can advance even when one adjustment leaves the same tiles selected. It leaves the application's tile-size preference intact and gradually restores detail after sustained spare capacity: each recovery step is sized from the measured admission headroom of the resident selection, and a rejected step backs off exponentially (5 s to 60 s) before the next attempt. Driver allocation failure lowers the admission budget. Sources whose coarsest available content exceeds the budget may remain deferred; diagnostics report memory-limited selections. Removing a source releases its retained ownership. [TileAdmin.gpuMemoryLimit]($frontend) still independently governs cached tile content.

Ratified `KHR_gaussian_splatting` content preserves camera-distance ordering in perspective views, including the default when `sortingMethod` is absent. The established Cesium draft follows view-depth ordering. Orthographic views sort by depth. A single WASM radix kernel sorts bounded global scalar keys for all transformed occurrences; colliding quantized keys are refined using their original values.

## Reproducible benchmark

From `core/frontend`, run:

```sh
ITWIN_GAUSSIAN_BENCHMARK=1 rushx test GaussianSplatsBenchmark.test.ts --reporter=verbose
```

The opt-in fixture draws one million and four million splats, measures worker sort latency, time to the first visible sorted frame including upload/readiness, and five render-plus-`gl.finish()` wall samples, and prints the actual viewport, GPU renderer, browser version, SH degree, and memory allocation. The wall samples alone do not verify GPU completion on every browser/backend; use the comparison's GPU queries and completion probe below for draw-cost comparisons. This synthetic baseline does not predict a capture with large overlapping ellipses. Routine test runs skip these large allocations. Verification results are recorded in the [plan](./GaussianSplatsPlan.md).

To isolate atlas staging from changing tile selections, run `ITWIN_GAUSSIAN_BENCHMARK=1 rushx test GaussianSplatsUploadBenchmark.test.mts --maxWorkers=1`. This fixture replaces three tiles containing 750,000 splats in total, retaining two tiles at each replacement. It records twelve samples after four warmups in `lib/gaussian-upload-benchmark.json`. The data includes SH, full-precision covariance and exact appearance. Recorded wall times include driver calls but do not establish GPU completion or navigation FPS.

To measure main-thread instance remapping separately, run `ITWIN_GAUSSIAN_BENCHMARK=1 rushx test GaussianSplatInstances.test.ts --maxWorkers=1 --reporter=verbose`. The opt-in case prints twelve raw samples after four warmups for one million sorted instances with unchanged, translated/reordered, and filtered tile mappings. Unchanged mappings reuse the worker result; uniformly translated tile pages use one precomputed address offset. Other layouts retain the general page mapping. These optimizations preserve the worker's global order.

To capture the official Cesium compressed fixture in a native iTwin viewport, run `ITWIN_GAUSSIAN_SCREENSHOT=1 rushx test GaussianSplatsCapture.test.mts`. The test saves `lib/gaussian-splats-cesium.png`.

For a recognizable scene, add `ITWIN_GAUSSIAN_SCREENSHOT_URL=https://raw.githubusercontent.com/CesiumGS/cesium/1.146/Specs/Data/Cesium3DTiles/GaussianSplats/tower/0/0.glb` to that command. This downloads Cesium's public tower fixture (286,868 splats) without ion credentials. The opt-in capture uses ANGLE Metal on macOS, checks that the framebuffer varies spatially, and fits the camera with an explicit lens angle.

To exercise the complete live ion reality-model pipeline, add `ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET=4547222` instead. This explicit opt-in uses CesiumJS 1.146's bundled public evaluation token in memory, attaches the tileset through the native reality-model API, waits for selected tile content, and captures the iTwin framebuffer. Public evaluation access is intended for validation; configure the application's own access client for deployment.

Add `ITWIN_GAUSSIAN_SCREENSHOT_COMPARE=1` to compare overview, oblique, and detail views against CesiumJS 1.146. The test matches the ECEF camera, projection/depth planes, and framebuffer dimensions, then saves `lib/gaussian-parity.html`, raw measurements in `lib/gaussian-parity.json`, and three labeled image pairs. The HTML report provides an image slider, side-by-side and single-renderer views, and 100%/200% pixel sizes for desktop inspection. These controls review recorded images. The SDK loads only in this optional test. The official SPZ tower fixture is wrapped as one Cesium tile containing the identical GLB, which isolates rendering from LOD selection. Ion comparisons also report selected tiles and actual splat counts, since equal SSE settings can produce different workloads.

Adjust detail before a capture with `ITWIN_GAUSSIAN_SCREENSHOT_CESIUM_SSE` (default 16) and `ITWIN_GAUSSIAN_SCREENSHOT_NATIVE_MODIFIER` (default 1); both must be positive finite numbers. Lower values request finer detail in the corresponding renderer. The capture waits for sustained reference readiness, including zero pending/processing requests and a committed snapshot matching the selected content, then checks readiness again after timing. Nested ion tilesets can briefly report readiness while showing a coarse fallback; a first visible frame alone is insufficient for a settled comparison.

Each view measures 60 warm settled frames after ten warmup frames. Renderers run sequentially with automatic loops stopped, recording render-call and post-`gl.finish()` wall times, GPU elapsed timer queries when supported, and frame completion verified by a one-pixel readback. Instanced GL calls are observed to verify fresh drawing on every measured frame. Full screenshots occur after timing. The one-pixel probe adds synchronization/readback overhead; render-call wall time can include driver/GPU waits and is not pure CPU work. Native phase timings are recorded separately and overlap. On the tested Chromium/ANGLE Metal backend, `gl.finish()` wall times alone significantly understated reference GPU work. Older report timings using only `finish()` are historical wall observations, not GPU-completed frame costs. The report presents GPU median/p95 when available and labels the completion probe separately. These measurements do not establish input latency or presented FPS. Foreground overlap, RGB RMS difference, and signed brightness difference are observational, with no invented visual-parity threshold.

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

Each observed draw also includes `atlasUploads`: synchronous atlas replacement wall time, texture allocation/upload call times, allocated/uploaded bytes, total and retained splat counts, and success status. An empty array means that draw performed no atlas replacement. These measurements cover shared-atlas work inside the observed color draw, excluding unrelated viewport updates and disposal. Timings are disabled when no observer is installed. Auxiliary arrays are uploaded as contiguous blocks using bounded page staging, without changing stored values or residency budgets.

To repeat camera poses, start either recorder and enter `dta gaussian trace replay /private/tmp/gaussian-visual.json`. Playback uses the recorded timestamps without waiting for loading or sorting and records the poses actually executed. Keep the source, viewport size, clipping, tile-size modifier, and map/terrain settings matched when comparing runs. This is a programmatic pose route; use actual wheel/pointer actions for input latency. Existing DTA Camera Paths also remain available for saved navigation routes.

Treat the gates separately. Known visible-region pixel assertions establish offline continuity. Settled Gaussian-source selections at different depths with different completed generations establish observed refinement; pending tile selection alone does not. A live trace without trusted pixel probes reports visual continuity as unverified, even when every draw submits splats. Responsiveness requires a baseline on the recorded hardware; native submission and browser animation callbacks do not measure display presentation latency. Reduced-size captures and the synthetic patches cannot guarantee that a real capture has no local LOD seams, so inspect the live contact sheet and add settled reference patches when investigating a new artifact.
