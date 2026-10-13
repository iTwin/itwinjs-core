# Gaussian splats preview

The native iTwin.js WebGL2 renderer can display Gaussian splat reality models through the existing 3D Tiles pipeline. It does not use Cesium's rendering engine.

Gaussian splats represent a captured scene as overlapping ellipses, not surface geometry. Use them as visual context alongside an iModel. Splats are visual context only: picking, snapping, measurement geometry and section cuts are not supported.

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
| 3D Tiles | Explicit tile trees with one GLB/glTF per tile, including nested external tilesets, whose tileset declares `KHR_gaussian_splatting` in its `3DTILES_content_gltf` extension |
| `KHR_gaussian_splatting` | Ellipse kernel, linear scales, normalized opacity, xyzw rotation, and complete spherical harmonics through degree 3 |
| Trained color spaces | `srgb_rec709_display` and `lin_rec709_display` |
| `KHR_gaussian_splatting_compression_spz_2` (draft) | SPZ version 2 payloads, decoded to glTF LUF coordinates as the draft requires |
| Cesium ion's draft content | SPZ version 3 payloads in the draft layout (`COLOR_0` placeholders, no `kernel`, `colorSpace` or degree-zero spherical harmonics), with stored coordinates preserved |
| Views | Perspective and orthographic 3D views |
| Scene integration | View and branch clipping, opaque BIM depth (also in views with MSAA), and uniform color/transparency overrides |

`KHR_gaussian_splatting` is ratified; `KHR_gaussian_splatting_compression_spz_2` is a draft (Khronos glTF pull request 2531), so its metadata and payload conventions can change. Cesium ion serves content that predates it: payloads are SPZ version 3, stored without the LUF conversion the draft requires, and CesiumJS 1.146 decodes them as stored. iTwin.js decodes SPZ 3 payloads in the draft layout the same way. An SPZ 2 payload is decoded in LUF coordinates even in the draft layout, so content written to the draft text is not mistaken for ion's. This adapter will be removed once Cesium ion serves content that follows the extensions, or CesiumJS decodes it in LUF.

Splats are drawn as the 3D Gaussian Splatting paper's forward pass draws them, which `KHR_gaussian_splatting` asks for: the projected covariance is widened by 0.3 square pixels and cut off at three sigma. CesiumJS 1.146 widens it by only 0.01875 square pixels (its stored covariance is four times the true one and its focal length twice the pixel focal length, so its 0.3 amounts to 0.3/16 square pixels) and cuts off at 2.83 sigma. Thin and distant splats therefore look slightly wider, softer and more opaque here than in CesiumJS; over a dark background, the field looks a little brighter. As in CesiumJS, a splat's projected semi-axes are capped at 512 pixels at three sigma; the cap is in CSS pixels, so very near splats cover the same part of the view on high-DPI displays as elsewhere.

A tileset that does not declare `KHR_gaussian_splatting` is drawn as an ordinary reality model: its splat primitives are drawn as the colored points they also are, the fallback the extension provides for loaders without splat support. Splats must be declared because their tiles are selected differently: a tile is replaced only once all its children are ready, since splats cannot be clipped to a tile's region and a tile drawn together with its children would show both. Splats in a glTF asset read by [readGltf]($frontend), such as a decoration's, are drawn as splats.

The original `KHR_spz_gaussian_splats_compression` extension is unsupported. Retile that content with the current Cesium ion pipeline.

The preview does not support:

- Implicit tiling or multiple contents per tile.
- Standalone PLY or SPZ files.
- Reconstruction, upload, export, or tiling.

## Rendering and interaction limits

Splats blend in a globally sorted viewport pass after opaque geometry and before ordinary translucent geometry. Opaque BIM geometry can occlude splats.

The renderer composes colors in the declared trained color space before display conversion:

- Splats trained in display space (`srgb_rec709_display`, nearly all content) blend straight into the view, premultiplied and back to front, at the view's 8 bits per channel.
- Splats trained in linear space (`lin_rec709_display`) must blend in linear space. They blend into a separate color field, which is then converted and composited into the view. The field is half float where the device can render floating-point colors, otherwise 8 bits, which loses precision.

Splats are not multisampled. In a view with MSAA they are drawn into the resolved single-sample image and tested against the resolved depth, so their edges against BIM geometry are not antialiased. Blending every splat into each sample would cost several times as much.

The preview does not support:

- Interleaving fields trained in different color spaces.
- Volume or planar classification, and planar clip masks: a reality model's planar clip mask does not clip its splats.
- Thematic display or selection highlighting.

During tile refinement, the renderer retains a completed field until its replacement has ready coverage and a completed global sort. Initial content appears after its first sort and can load progressively. Detail changes do not crossfade.

Because the sort runs on a worker, splats appear a frame or more after their tiles are ready. An image rendered in a single frame, such as one that an [OffScreenViewport]($frontend) renders for [Viewport.readImageBuffer]($frontend) or a thumbnail, therefore includes no splats.

## Limitations

Splats write no depth, so passes drawn after them see only opaque geometry.

Translucent BIM geometry is depth-tested against opaque geometry only, so translucent BIM behind splats is drawn over them, as if it were in front. Here a translucent blue slab lies beneath the scan's ground; it shows through the trees and the building standing on it:

![Translucent BIM behind splats drawn over them](./assets/gaussian-splats-translucent-bim.jpg)

Ambient occlusion is computed from opaque geometry before splats are drawn, and then darkens every pixel, so the occlusion of BIM behind splats darkens the splats in front of it. Here ambient occlusion is off on the left and on on the right: besides the shading at the edges of the BIM boxes, the occlusion of the slab beneath the scan darkens the splats over it:

![Ambient occlusion off and on](./assets/gaussian-splats-ambient-occlusion.jpg)

## Picking and navigation

Native Gaussian splats do not write model IDs or depth into the picking buffers. They cannot be selected, located or snapped to, and do not provide measurement points or semantic object properties. Ordinary BIM picking and snapping remain available, including for BIM behind visible splats: splats do not occlude pick results.

View tools retain their existing behavior. Where a splat-only view supplies no geometry hit, navigation uses the existing reference plane or view-target fallback. Rotation and zoom therefore do not anchor to the apparent splat surface. No shared tool event handling is changed.

Approximate splat picking is deferred until a concrete interaction requirement establishes its scope and accuracy expectations.

## Deployment

The splat renderer loads on demand, through a dynamic `import()`. A render system created with `enableGaussianSplats` starts loading it at once, so that it is usually ready before the first splat tile arrives (a tile that arrives first waits for it); applications that leave the option off never load it. Bundlers that split dynamic imports, such as Vite, Rollup, webpack and esbuild, put it in a chunk of its own: deploy that chunk with the application's other chunks.

Deploy the frontend package's public assets with the application, including `scripts/gaussian-splats-worker.js`. Use the same [IModelApp.publicPath]($frontend) configuration as other frontend workers. Retain the frontend package’s `ThirdPartyNotices.md` in your application’s third-party notices: the worker's SPZ decoder follows Niantic's MIT-licensed reference implementation.

SPZ decoding and sorting run in a browser worker, in JavaScript. The Content Security Policy must permit the worker; it need not permit WebAssembly.

For a public path on another origin, support the existing blob/importScripts worker pattern and provide appropriate CORS headers.

## Memory and detail

Decoded storage uses 32 bytes per splat: float mean, 16-bit rotation and log scales, and 12-bit color and opacity on grids that contain SPZ's 8-bit values exactly. Spherical harmonic bands above degree 0 add 16, 32 or 48 bytes per splat (degrees 1 to 3): one byte per coefficient, plus one exponent byte per band and splat in otherwise unused padding. SPZ coefficients keep their exact 1/128 grid. Other coefficients are quantized relative to the largest magnitude in their own band of the same splat, to within about 0.4% of it, so a single large coefficient elsewhere in a tile does not flatten view-dependent color. Tile statistics include the packed CPU arrays, and the tile's GPU storage while it is resident.

Color precision is set for display (sRGB) values. The 12-bit DC code has a step of about 0.00092 in trained color units. That is under a quarter of an 8-bit code for `srgb_rec709_display` content, and finer than SPZ's own 8-bit color. For uncompressed `lin_rec709_display` content, the same linear step is about three 8-bit sRGB codes near black, so very dark gradients can band. The 32-byte layout has no spare bits for a finer or per-splat color range. Content that depends on deep shadows should be trained or exported in `srgb_rec709_display`.

Splat memory is governed by [TileAdmin.gpuMemoryLimit]($frontend), like all tile content; there is no separate splat budget. A splat tile's content is its packed CPU arrays, which viewports sort, and the rows it occupies in the GPU atlas that all viewports share. The tile cache counts those rows from the time the tile loads, but the atlas holds them only while a viewport displays the tile or is about to: they are uploaded when the tile joins a viewport's candidate field, and freed once no viewport retains it. The atlas grows by copying its rows on the GPU into a larger array, with spare capacity, and is rebuilt smaller once less than half of it is in use; memory statistics report that spare capacity separately from the tiles.

When the tiles in use by all viewports exceed the limit, reality models that select tiles by geometric error, splat models among them, select coarser tiles: their screen-space error tolerance rises by 2% per frame, as in CesiumJS, and falls by 2% per frame once their tiles in use take less than 80% of the limit and no tile content is loading. Their tiles are compared with what the limit leaves after other tiles in use, such as iModel tiles, which cannot be coarsened; they may always take at least half of the limit. Tiles no viewport uses are freed first, least recently used first, as for all tile content. A tolerance that turned out to exceed the limit after detail was restored is not tried again until a view, the viewports or the limit change, so a static view settles. The texture arrays also have a device limit on their layers (2,048 on many GPUs, about 33 million splats; higher SH bands are limited to 512 layers by the tile metadata's float precision). When a field's tiles do not fit it, the viewport keeps its previous field, unused tiles are freed and the tolerance rises as above.

Each viewport's sorting worker (its copy of the splat positions, the scratch of a running sort and the sorted order) and the shared decoding worker (the inputs of the tiles waiting for it and the packing workload of the one it decodes) are reported in memory statistics, but are not tile content and do not count toward the limit. At full detail, the Redmond campus capture (Cesium ion asset 4547222) selects 65 tiles and 1.85 million splats in a 1440 by 900 view.

A tile may hold at most 2,097,152 splats, and decoding it may use at most 512 MiB: its input, the decoded values and the packed result. With SPZ or float attributes, tiles of the full 2,097,152 splats fit at spherical harmonic degrees 0 and 1. At degree 2 the memory limit allows about 2.06 million SPZ splats or 1.46 million float splats per tile, and at degree 3 about 1.41 million or 0.97 million. Both limits are checked before the tile's data is copied or decompressed, and an SPZ payload that decompresses to more data than its header declares is rejected as soon as it does. Producers must split larger tiles.

The decoding worker decodes one tile at a time. If its script fails to load, or a decode takes more than 30 seconds, it is replaced: the tiles waiting for it are decoded by the replacement, and the tile it was decoding is requested again. After three consecutive worker failures, a further failure leaves its tile empty, so that a decoder that cannot run at all (for example, a worker script that is not deployed) does not make tiles retry forever.
