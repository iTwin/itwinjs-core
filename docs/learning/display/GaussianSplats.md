# Gaussian splats preview

The native iTwin.js WebGL2 renderer can display Gaussian splat reality models through the existing 3D Tiles pipeline. It does not use Cesium's rendering engine.

Gaussian splats represent a captured scene as overlapping ellipses, not surface geometry. Use them as visual context alongside an iModel. They do not provide geometry for snapping, measurement, or section cuts.

This alpha preview is disabled by default.

## Enable the preview

Enable Gaussian splats when the application starts:

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

For Cesium ion assets, configure the application's [CesiumAccessClient]($frontend) or `TileAdmin.Props.cesiumIonKey` and reality-data source key. Tile content and external glTF buffers use the existing reality-data transport.

## Try it in Display Test App

Set `IMJS_ENABLE_GAUSSIAN_SPLATS=1` before starting Display Test App (DTA).

Use the existing reality-model tools to attach a compatible tileset to an iModel view. The view must include the capture's geographic location.

For a standalone Cesium ion preview:

1. Set `IMJS_CESIUM_ION_KEY` to a key with access to the asset.
2. Start DTA with the preview enabled.
3. Enter `dta gaussian ion <assetId>` in the key-in field.

For example:

```text
dta gaussian ion 4547222
```

This command opens a blank connection at the asset's location, attaches the tileset, and aims the view at it. Asset access depends on the configured key.

Use DTA's existing Models, Diagnostics, and Inspect Element controls to inspect a scene that combines BIM geometry and splats.

## Supported content

| Content | Preview support |
| --- | --- |
| 3D Tiles | Explicit tile trees with one GLB/glTF per tile, including nested external tilesets |
| `KHR_gaussian_splatting` | Ellipse kernel, linear scales, normalized opacity, xyzw rotation, and complete spherical harmonics through degree 3 |
| Trained color spaces | `srgb_rec709_display` and `lin_rec709_display` |
| `KHR_gaussian_splatting_compression_spz_2` | Nested SPZ v2 content with current base metadata, decoded to glTF LUF coordinates |
| Established Cesium ion draft profile | COLOR_0 placeholders without kernel/colorSpace or degree-zero spherical harmonics, with stored coordinates preserved and SPZ v2/v3 support |
| Views | Perspective and orthographic 3D views |
| Scene integration | View and branch clipping, opaque BIM depth, MSAA, approximate model picking, and uniform color/transparency overrides |

The established Cesium draft profile matches CesiumJS 1.146. Draft compression metadata and payload conventions can change.

The original `KHR_spz_gaussian_splats_compression` extension is unsupported. Retile that content with the current Cesium ion pipeline.

The preview does not support:

- Implicit tiling or multiple contents per tile.
- Standalone PLY or SPZ files.
- Reconstruction, upload, export, or tiling.

## Rendering and interaction limits

Splats blend in a globally sorted viewport pass after opaque geometry and before ordinary translucent geometry. Opaque BIM geometry can occlude splats.

The renderer composes colors in the declared trained color space before display conversion. Floating-point composition requires device support. The normalized-buffer fallback loses precision.

The preview does not support:

- Correct interleaving with translucent BIM geometry.
- Interleaving fields trained in different color spaces.
- Volume or planar classification.
- Thematic display or selection highlighting.

Model picking uses a camera-facing plane through each splat's center, with effective Gaussian alpha of at least 0.1. This approximates the visible field, not a reconstructed surface.

By default, the pick buffer excludes splats during cursor motion. Hover locate includes splats after the cursor rests for 100 ms. Cursor-based depth operations during motion, such as wheel zoom, use BIM geometry or the view's default target.

During tile refinement, the renderer retains a completed field until its replacement has ready coverage and a completed global sort. Initial content appears after its first sort and can load progressively. Detail changes do not crossfade.

## Deployment

Deploy the frontend package's public assets with the application, including `scripts/gaussian-splats-worker.js`. Use the same [IModelApp.publicPath]($frontend) configuration as other frontend workers.

SPZ decoding runs in a browser worker with embedded WebAssembly. The Content Security Policy must permit the worker and WebAssembly compilation.

For a public path on another origin, support the existing blob/importScripts worker pattern and provide appropriate CORS headers.

## Memory and detail

Decoded base storage uses at least 32 bytes per splat. Spherical harmonics and precision supplements increase storage. Tile statistics include packed CPU arrays and corresponding GPU storage.

GPU storage is shared across viewports. The renderer applies a 256 MiB GPU residency budget and a 512 MiB estimated workload budget. These limits do not measure the device's free VRAM.

The worker rejects individual tiles with more than 2,097,152 splats or an estimated packing workload greater than 512 MiB. Producers must split such tiles.

When a selection exceeds the memory budget, the renderer retains its completed field and requests coarser Gaussian tiles. It restores detail gradually when capacity permits. A source can remain deferred if its coarsest content exceeds the budget.

[TileAdmin.gpuMemoryLimit]($frontend) independently governs cached tile content.
